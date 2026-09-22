import { api, setToken } from "@/lib/api/client";

export async function updateProfileInfo(input: {
  firstName: string;
  lastName: string;
  phone: string | null;
  birthDate?: string | null;
}): Promise<void> {
  const patch: Record<string, string | null> = {
    first_name: input.firstName,
    last_name: input.lastName,
    phone: input.phone,
  };
  if (input.birthDate !== undefined) {
    patch.birth_date = input.birthDate;
  }

  await api.patch("/me/profile", patch);
}

export async function updateEmail(email: string): Promise<void> {
  await api.patch("/me/email", { email });
}

/**
 * Changing the password invalidates every other session, so the API mints a
 * fresh token for this browser and it replaces the stored one.
 */
export async function updatePassword(
  currentPassword: string,
  password: string
): Promise<void> {
  const data = await api.patch<{ token: string }>("/me/password", {
    current_password: currentPassword,
    password,
  });
  setToken(data.token);
}

/**
 * The image is validated and resized server-side, so the browser sends the
 * file as picked. The returned URL carries a cache-busting suffix: the new
 * avatar overwrites the old one at the same path.
 */
export async function uploadAvatar(file: File): Promise<{ url: string }> {
  if (!file.type.startsWith("image/")) {
    throw new Error("فقط فایل تصویری مجاز است.");
  }

  return api.upload<{ url: string }>("/me/avatar", file);
}
