"use server";

// Subjects, documents and study sets.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { DOCUMENTS_BUCKET } from "@/lib/env";
import { SUBJECT_COLORS } from "@/lib/languages";
import { isUuid, uuidOrNull } from "@/lib/security";
import type { FormState, StudyMode } from "@/lib/types";

const text = (formData: FormData, key: string, max: number) => String(formData.get(key) ?? "").trim().slice(0, max);

export async function saveSubject(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireProfile();
  const id = uuidOrNull(text(formData, "id", 40));
  const name = text(formData, "name", 120);
  const color = text(formData, "color", 20);
  if (!name) return { error: "Give the subject a name." };
  const fields = {
    name,
    code: text(formData, "code", 30) || null,
    description: text(formData, "description", 500) || null,
    color: (SUBJECT_COLORS as readonly string[]).includes(color) ? color : "teal",
  };
  const { error } = id
    ? await supabase.from("subjects").update(fields).eq("id", id)
    : await supabase.from("subjects").insert(fields);
  if (error) return { error: "Could not save the subject. Try again." };
  revalidatePath("/subjects");
  if (id) revalidatePath(`/subjects/${id}`);
  return { message: "Saved." };
}

export async function deleteSubject(id: string) {
  const { supabase } = await requireProfile();
  if (!isUuid(id)) redirect("/subjects");
  await supabase.from("subjects").delete().eq("id", id);
  revalidatePath("/subjects");
  redirect("/subjects");
}

/** Returns the extracted page text of one of the user's PDFs, for drafting questions. */
export async function getDocumentText(id: string): Promise<string[] | null> {
  const { supabase } = await requireProfile();
  if (!isUuid(id)) return null;
  const { data } = await supabase.from("documents").select("extracted_pages").eq("id", id).maybeSingle();
  return Array.isArray(data?.extracted_pages) ? data.extracted_pages.map((page: unknown) => String(page ?? "")) : null;
}

export async function updateDocument(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireProfile();
  const id = uuidOrNull(text(formData, "id", 40));
  const title = text(formData, "title", 200);
  if (!id) return { error: "Document not found." };
  if (!title) return { error: "Give the document a title." };
  const { error } = await supabase
    .from("documents")
    .update({ title, subject_id: uuidOrNull(text(formData, "subject_id", 40)) })
    .eq("id", id);
  if (error) return { error: "Could not save the document. Try again." };
  revalidatePath("/library");
  revalidatePath(`/library/${id}`);
  return { message: "Saved." };
}

export async function deleteDocument(id: string) {
  const { supabase, user } = await requireProfile();
  if (!isUuid(id)) redirect("/library");
  const { data } = await supabase.from("documents").select("storage_path").eq("id", id).maybeSingle();
  if (data) {
    const path = String(data.storage_path);
    if (path.startsWith(`${user.id}/`)) await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]);
    await supabase.from("documents").delete().eq("id", id);
  }
  revalidatePath("/library");
  redirect("/library");
}

function readSetFields(formData: FormData) {
  const minutes = Number(formData.get("time_limit_minutes"));
  return {
    title: text(formData, "title", 200),
    description: text(formData, "description", 1000) || null,
    subject_id: uuidOrNull(text(formData, "subject_id", 40)),
    document_id: uuidOrNull(text(formData, "document_id", 40)),
    time_limit_minutes: Number.isInteger(minutes) && minutes >= 1 && minutes <= 600 ? minutes : null,
    shuffle_questions: formData.get("shuffle_questions") === "on",
    shuffle_options: formData.get("shuffle_options") === "on",
  };
}

export async function createSet(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, isTechnical } = await requireProfile();
  const mode = text(formData, "mode", 30) as StudyMode;
  if (!["multiple_choice", "identification", "coding"].includes(mode)) return { error: "Choose a study mode." };
  if (mode === "coding" && !isTechnical) return { error: "Fill in the Code is available to technology programs." };
  const fields = readSetFields(formData);
  if (!fields.title) return { error: "Give the study set a title." };

  const { data, error } = await supabase
    .from("study_sets")
    .insert({ ...fields, mode, shuffle_questions: true, shuffle_options: true })
    .select("id")
    .single();
  if (error || !data) return { error: "Could not create the study set. Try again." };
  revalidatePath("/sets");
  redirect(`/sets/${data.id}/edit`);
}

export async function updateSet(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireProfile();
  const id = uuidOrNull(text(formData, "id", 40));
  const fields = readSetFields(formData);
  if (!id) return { error: "Study set not found." };
  if (!fields.title) return { error: "Give the study set a title." };
  const { document_id: _ignored, ...update } = fields;
  void _ignored;
  const { error } = await supabase.from("study_sets").update(update).eq("id", id);
  if (error) return { error: "Could not save the study set. Try again." };
  revalidatePath(`/sets/${id}`);
  revalidatePath(`/sets/${id}/edit`);
  return { message: "Settings saved." };
}

export async function deleteSet(id: string) {
  const { supabase } = await requireProfile();
  if (!isUuid(id)) redirect("/sets");
  await supabase.from("study_sets").delete().eq("id", id);
  revalidatePath("/sets");
  redirect("/sets");
}
