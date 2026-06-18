import { toast } from "sonner";

/**
 * Executes a Supabase mutation and shows a toast on success or error.
 * Returns `true` when the operation succeeded.
 */
export async function supabaseMutate(
  mutation: PromiseLike<{ error: { message: string } | null }>,
  successMessage: string,
): Promise<boolean> {
  const { error } = await mutation;
  if (error) {
    toast.error(error.message);
    return false;
  }
  toast.success(successMessage);
  return true;
}
