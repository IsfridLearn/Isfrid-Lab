-- ISFRID schema: tables, constraints, triggers, row-level security and the private documents bucket.

-- ───────────────────────── helpers ─────────────────────────

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ───────────────────── academic programs ─────────────────────

create table public.academic_programs (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  is_technical boolean not null default false,
  allows_custom_name boolean not null default false,
  sort_order int not null default 0
);

insert into public.academic_programs (code, name, is_technical, allows_custom_name, sort_order) values
  ('BSIT',       'BS Information Technology',          true,  false, 10),
  ('BSCS',       'BS Computer Science',                true,  false, 20),
  ('BSIS',       'BS Information Systems',             true,  false, 30),
  ('SE',         'Software Engineering',               true,  false, 40),
  ('CPE',        'Computer Engineering',               true,  false, 50),
  ('OTHER_TECH', 'Other technology-related program',   true,  true,  60),
  ('OTHER',      'Other academic program',             false, true,  70);

-- ───────────────────────── profiles ─────────────────────────

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  program_id uuid references public.academic_programs (id),
  custom_program text check (char_length(custom_program) <= 120),
  onboarded boolean not null default false,
  weekly_goal int not null default 5 check (weekly_goal between 1 and 50),
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create a profile row whenever someone registers.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- True when the signed-in user's program unlocks the coding study mode.
create or replace function public.is_technical_user()
returns boolean language sql stable set search_path = '' as $$
  select coalesce((
    select ap.is_technical
    from public.profiles p
    join public.academic_programs ap on ap.id = p.program_id
    where p.id = (select auth.uid())
  ), false)
$$;

-- ───────────────────────── subjects ─────────────────────────

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  code text check (char_length(code) <= 30),
  description text check (char_length(description) <= 500),
  color text not null default 'teal',
  created_at timestamptz not null default now()
);
create index subjects_user_idx on public.subjects (user_id, created_at desc);

-- ───────────────────────── documents ─────────────────────────

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid references public.subjects (id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  file_name text not null,
  storage_path text not null unique,
  size_bytes bigint not null check (size_bytes > 0),
  page_count int not null default 0,
  char_count int not null default 0,
  extracted_pages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (size_bytes <= 20971520),
  check (page_count >= 0 and char_count >= 0),
  check (jsonb_typeof(extracted_pages) = 'array' and octet_length(extracted_pages::text) <= 8000000)
);
create index documents_user_idx on public.documents (user_id, created_at desc);
create index documents_subject_idx on public.documents (subject_id);
create trigger documents_updated before update on public.documents
  for each row execute function public.set_updated_at();

-- ───────────────────────── study sets ─────────────────────────

create table public.study_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid references public.subjects (id) on delete set null,
  document_id uuid references public.documents (id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  description text check (char_length(description) <= 1000),
  mode text not null check (mode in ('multiple_choice', 'identification', 'coding')),
  time_limit_minutes int check (time_limit_minutes between 1 and 600),
  shuffle_questions boolean not null default true,
  shuffle_options boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index study_sets_user_idx on public.study_sets (user_id, updated_at desc);
create index study_sets_subject_idx on public.study_sets (subject_id);
create trigger study_sets_updated before update on public.study_sets
  for each row execute function public.set_updated_at();

-- ─────────────── questions (multiple choice + identification) ───────────────

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  set_id uuid not null references public.study_sets (id) on delete cascade,
  type text not null check (type in ('multiple_choice', 'identification')),
  prompt text not null check (char_length(prompt) between 1 and 4000),
  explanation text check (char_length(explanation) <= 4000),
  source_document_id uuid references public.documents (id) on delete set null,
  source_page int,
  position int not null default 0,
  points int not null default 1 check (points between 1 and 100),
  created_at timestamptz not null default now()
);
create index questions_set_idx on public.questions (set_id, position);
create index questions_user_idx on public.questions (user_id);

create table public.answer_options (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  is_correct boolean not null default false,
  position int not null default 0
);
create index answer_options_question_idx on public.answer_options (question_id, position);
create index answer_options_user_idx on public.answer_options (user_id);

create table public.accepted_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500)
);
create index accepted_answers_question_idx on public.accepted_answers (question_id);
create index accepted_answers_user_idx on public.accepted_answers (user_id);

-- ───────────────────────── coding exercises ─────────────────────────

create table public.coding_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  set_id uuid not null references public.study_sets (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  exercise_type text not null check (exercise_type in (
    'missing_code', 'missing_variables', 'missing_functions',
    'missing_statements', 'missing_blocks', 'predict_output', 'debug')),
  language text not null check (language in ('c', 'cpp', 'java', 'python', 'javascript', 'php', 'sql')),
  description text not null default '',
  instructions text not null default '',
  hints jsonb not null default '[]'::jsonb,
  template_code text not null default '',
  solution_code text not null default '',
  setup_code text not null default '',
  validation text not null check (validation in ('blanks', 'output', 'tests', 'solution')),
  blanks jsonb not null default '[]'::jsonb,
  expected_output text not null default '',
  position int not null default 0,
  points int not null default 10 check (points between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index coding_exercises_set_idx on public.coding_exercises (set_id, position);
create index coding_exercises_user_idx on public.coding_exercises (user_id);
create trigger coding_exercises_updated before update on public.coding_exercises
  for each row execute function public.set_updated_at();

create table public.coding_test_cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.coding_exercises (id) on delete cascade,
  stdin text not null default '',
  expected_output text not null default '',
  is_hidden boolean not null default false,
  position int not null default 0
);
create index coding_test_cases_exercise_idx on public.coding_test_cases (exercise_id, position);
create index coding_test_cases_user_idx on public.coding_test_cases (user_id);

-- ───────────────────────── assessments ─────────────────────────

create table public.assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  set_id uuid references public.study_sets (id) on delete set null,
  subject_id uuid references public.subjects (id) on delete set null,
  set_title text not null,
  mode text not null check (mode in ('multiple_choice', 'identification', 'coding')),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  item_order jsonb not null default '[]'::jsonb,
  time_limit_seconds int check (time_limit_seconds > 0),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  duration_seconds int,
  item_count int not null default 0,
  correct_count int not null default 0,
  total_points numeric(8, 2) not null default 0,
  earned_points numeric(8, 2) not null default 0,
  score_percent numeric(5, 2) not null default 0 check (score_percent between 0 and 100)
);
create index attempts_user_idx on public.assessment_attempts (user_id, status, completed_at desc);
create index attempts_set_idx on public.assessment_attempts (set_id);
create index attempts_subject_idx on public.assessment_attempts (subject_id);

create table public.assessment_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  attempt_id uuid not null references public.assessment_attempts (id) on delete cascade,
  question_id uuid references public.questions (id) on delete set null,
  exercise_id uuid references public.coding_exercises (id) on delete set null,
  position int not null default 0,
  prompt text not null default '',
  response jsonb,
  correct_answer jsonb,
  is_correct boolean not null default false,
  points_earned numeric(8, 2) not null default 0,
  points_possible numeric(8, 2) not null default 0,
  unique (attempt_id, question_id),
  unique (attempt_id, exercise_id)
);
create index answers_attempt_idx on public.assessment_answers (attempt_id, position);
create index answers_user_idx on public.assessment_answers (user_id);

create table public.coding_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.coding_exercises (id) on delete cascade,
  attempt_id uuid references public.assessment_attempts (id) on delete set null,
  language text not null,
  code text not null default '',
  status text not null check (status in ('passed', 'partial', 'failed')),
  score numeric(5, 4) not null default 0 check (score between 0 and 1),
  passed_count int not null default 0,
  total_count int not null default 0,
  results jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index submissions_exercise_idx on public.coding_submissions (exercise_id, created_at desc);
create index submissions_user_idx on public.coding_submissions (user_id, created_at desc);

-- ───────────────────────── progress ─────────────────────────

create table public.user_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  activity_date date not null,
  assessments_completed int not null default 0,
  items_answered int not null default 0,
  items_correct int not null default 0,
  coding_completed int not null default 0,
  primary key (user_id, activity_date)
);

create or replace function public.user_local_date(uid uuid)
returns date language plpgsql stable security definer set search_path = '' as $$
declare tz text;
begin
  select p.timezone into tz from public.profiles p where p.id = uid;
  begin
    return (now() at time zone coalesce(tz, 'UTC'))::date;
  exception when others then
    return (now() at time zone 'UTC')::date;
  end;
end $$;

create or replace function public.bump_progress(uid uuid, n_assess int, n_items int, n_correct int, n_coding int)
returns void language sql security definer set search_path = '' as $$
  insert into public.user_progress as up
    (user_id, activity_date, assessments_completed, items_answered, items_correct, coding_completed)
  values (uid, public.user_local_date(uid), n_assess, n_items, n_correct, n_coding)
  on conflict (user_id, activity_date) do update set
    assessments_completed = up.assessments_completed + excluded.assessments_completed,
    items_answered = up.items_answered + excluded.items_answered,
    items_correct = up.items_correct + excluded.items_correct,
    coding_completed = up.coding_completed + excluded.coding_completed
$$;

create or replace function public.on_attempt_completed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'completed' and (tg_op = 'INSERT' or old.status is distinct from 'completed') then
    perform public.bump_progress(
      new.user_id, 1, new.item_count, new.correct_count,
      case when new.mode = 'coding' then new.correct_count else 0 end);
  end if;
  return new;
end $$;

create trigger attempt_completed after insert or update of status on public.assessment_attempts
  for each row execute function public.on_attempt_completed();

-- Practice submissions (outside an assessment) also count as study activity.
create or replace function public.on_practice_submission()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.attempt_id is null then
    perform public.bump_progress(
      new.user_id, 0, 1,
      case when new.status = 'passed' then 1 else 0 end,
      case when new.status = 'passed' then 1 else 0 end);
  end if;
  return new;
end $$;

create trigger practice_submission after insert on public.coding_submissions
  for each row execute function public.on_practice_submission();

-- ───────────────────── code execution rate limit ─────────────────────

create table public.execution_usage (
  user_id uuid primary key references auth.users (id) on delete cascade,
  window_start timestamptz not null default now(),
  used int not null default 0
);

create or replace function public.take_execution_tokens(tokens int)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  cost int := greatest(1, least(coalesce(tokens, 1), 10));
  allowed boolean;
begin
  if uid is null then
    return false;
  end if;
  insert into public.execution_usage as u (user_id, window_start, used)
  values (uid, now(), cost)
  on conflict (user_id) do update set
    window_start = case when u.window_start < now() - interval '1 minute' then now() else u.window_start end,
    used = case when u.window_start < now() - interval '1 minute' then cost else u.used + cost end
  where u.window_start < now() - interval '1 minute' or u.used + cost <= 30
  returning true into allowed;
  return coalesce(allowed, false);
end $$;

revoke execute on function public.take_execution_tokens(int) from public, anon;
grant execute on function public.take_execution_tokens(int) to authenticated;
revoke execute on function public.user_local_date(uuid) from public, anon, authenticated;
revoke execute on function public.bump_progress(uuid, int, int, int, int) from public, anon, authenticated;

-- ───────────────────── Row Level Security ─────────────────────

alter table public.academic_programs enable row level security;
alter table public.profiles enable row level security;
alter table public.subjects enable row level security;
alter table public.documents enable row level security;
alter table public.study_sets enable row level security;
alter table public.questions enable row level security;
alter table public.answer_options enable row level security;
alter table public.accepted_answers enable row level security;
alter table public.coding_exercises enable row level security;
alter table public.coding_test_cases enable row level security;
alter table public.assessment_attempts enable row level security;
alter table public.assessment_answers enable row level security;
alter table public.coding_submissions enable row level security;
alter table public.user_progress enable row level security;
alter table public.execution_usage enable row level security;

grant select on public.academic_programs to authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, program_id, custom_program, onboarded, weekly_goal, timezone) on public.profiles to authenticated;
grant select on public.user_progress to authenticated;
grant select, insert, update, delete on
  public.subjects, public.documents, public.study_sets, public.questions,
  public.answer_options, public.accepted_answers, public.coding_exercises,
  public.coding_test_cases, public.assessment_attempts, public.assessment_answers,
  public.coding_submissions
  to authenticated;

create policy "programs are readable by signed-in users" on public.academic_programs
  for select to authenticated using (true);

create policy "read own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "update own profile" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "read own progress" on public.user_progress
  for select to authenticated using (user_id = (select auth.uid()));

create policy "own subjects" on public.subjects for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own documents" on public.documents for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid())
    and storage_path like (select auth.uid())::text || '/%'
    and (subject_id is null or exists (select 1 from public.subjects s where s.id = subject_id)));

create policy "own study sets" on public.study_sets for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid())
    and (mode <> 'coding' or public.is_technical_user())
    and (subject_id is null or exists (select 1 from public.subjects s where s.id = subject_id))
    and (document_id is null or exists (select 1 from public.documents d where d.id = document_id)));

create policy "own questions" on public.questions for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid())
    and exists (select 1 from public.study_sets s where s.id = set_id));

create policy "own answer options" on public.answer_options for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid())
    and exists (select 1 from public.questions q where q.id = question_id));

create policy "own accepted answers" on public.accepted_answers for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid())
    and exists (select 1 from public.questions q where q.id = question_id));

create policy "own coding exercises" on public.coding_exercises for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid())
    and public.is_technical_user()
    and exists (select 1 from public.study_sets s where s.id = set_id and s.mode = 'coding'));

create policy "own coding test cases" on public.coding_test_cases for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid())
    and exists (select 1 from public.coding_exercises e where e.id = exercise_id));

create policy "own attempts" on public.assessment_attempts for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own attempt answers" on public.assessment_answers for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid())
    and exists (select 1 from public.assessment_attempts a where a.id = attempt_id));

create policy "own coding submissions" on public.coding_submissions for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid())
    and exists (select 1 from public.coding_exercises e where e.id = exercise_id));

-- ───────────────────────── storage ─────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 20971520, array['application/pdf'])
on conflict (id) do nothing;

create policy "documents bucket: read own" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "documents bucket: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "documents bucket: update own" on storage.objects for update to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "documents bucket: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
