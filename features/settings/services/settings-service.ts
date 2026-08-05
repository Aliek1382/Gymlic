import { createClient } from "@/lib/supabase/client";
import { compressImageToBlob } from "@/lib/image-compression";

const MAX_ORIGINAL_AVATAR_BYTES = 8 * 1024 * 1024;

async function getCurrentUserId(): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("نشست کاربر معتبر نیست.");
  return user.id;
}

export async function updateProfileInfo(input: {
  firstName: string;
  lastName: string;
  phone: string | null;
}): Promise<void> {
  const supabase = createClient();
  const userId = await getCurrentUserId();

  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: input.firstName,
      last_name: input.lastName,
      phone: input.phone,
    })
    .eq("id", userId);
  if (error) throw error;
}

// auth.users.email requires (project-config-dependent) confirmation before
// it actually switches, so profiles.email — a display-only mirror used
// elsewhere in the app — is updated eagerly rather than waiting for that.
export async function updateEmail(email: string): Promise<void> {
  const supabase = createClient();
  const userId = await getCurrentUserId();

  const { error: authError } = await supabase.auth.updateUser({ email });
  if (authError) throw authError;

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ email })
    .eq("id", userId);
  if (profileError) throw profileError;
}

export async function updatePassword(password: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export async function uploadAvatar(file: File): Promise<{ url: string }> {
  const supabase = createClient();
  const userId = await getCurrentUserId();

  if (!file.type.startsWith("image/")) {
    throw new Error("فقط فایل تصویری مجاز است.");
  }
  if (file.size > MAX_ORIGINAL_AVATAR_BYTES) {
    throw new Error("حجم تصویر انتخابی خیلی زیاد است (حداکثر ۸ مگابایت).");
  }

  const blob = await compressImageToBlob(file, { maxDimension: 512, quality: 0.82 });
  const path = `${userId}/avatar.jpg`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, blob, { contentType: "image/jpeg", upsert: true });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  // Cache-bust so <img> re-fetches the new file instead of a stale copy
  // cached under the same URL as the previous avatar.
  const url = `${data.publicUrl}?t=${Date.now()}`;

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ avatar_url: url })
    .eq("id", userId);
  if (profileError) throw profileError;

  return { url };
}
