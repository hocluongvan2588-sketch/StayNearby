import { revalidatePath } from 'next/cache';

export function safeRevalidateAll(paths: string[] = ['/']): void {
  try {
    revalidatePath('/', 'layout');
    for (const p of paths) {
      revalidatePath(p);
    }
  } catch {
    // Outside Next.js request/render context (e.g., Vitest or CLI scripts)
  }
}
