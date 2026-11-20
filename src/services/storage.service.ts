import { supabase, getPublicStorageUrl } from '../lib/supabase';

export const MENU_MEDIA_BUCKET = 'menu-media';
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function getExtensionForMime(mime: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

async function optimizeImageIfPossible(file: File): Promise<{ blob: Blob; mime: string }> {
  if (typeof document === 'undefined' || typeof createImageBitmap !== 'function') {
    return { blob: file, mime: file.type };
  }

  try {
    const bitmap = await createImageBitmap(file);
    const maxDimension = 1200;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return { blob: file, mime: file.type };
    }

    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const targetMime = file.type === 'image/png' ? 'image/png' : 'image/webp';
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, targetMime, 0.85)
    );

    if (!blob || blob.size > file.size * 1.15) {
      return { blob: file, mime: file.type };
    }

    return { blob, mime: blob.type || targetMime };
  } catch {
    return { blob: file, mime: file.type };
  }
}

export const storageService = {
  validateImageFile(file: File): void {
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      throw new Error('Formato de imagem inválido. Envie arquivos JPEG, PNG ou WebP.');
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new Error('A imagem excede o limite de 5 MB.');
    }
  },

  async uploadMenuImage(
    storeId: string,
    folder: 'products' | 'branding',
    file: File,
    previousPath?: string | null
  ): Promise<string> {
    this.validateImageFile(file);
    const optimized = await optimizeImageIfPossible(file);
    const ext = getExtensionForMime(optimized.mime);
    const objectPath = `${storeId}/${folder}/${generateUuid()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(MENU_MEDIA_BUCKET)
      .upload(objectPath, optimized.blob, {
        contentType: optimized.mime,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) throw uploadError;

    if (previousPath && previousPath !== objectPath && previousPath.startsWith(`${storeId}/`)) {
      // Limpeza best-effort do arquivo substituído
      await supabase.storage.from(MENU_MEDIA_BUCKET).remove([previousPath]).catch(() => undefined);
    }

    return objectPath;
  },

  async removeMenuImage(storeId: string, path: string | null | undefined): Promise<void> {
    if (!path || !path.startsWith(`${storeId}/`)) return;
    const { error } = await supabase.storage.from(MENU_MEDIA_BUCKET).remove([path]);
    if (error) throw error;
  },

  getPublicUrl(path: string | null | undefined): string | null {
    return getPublicStorageUrl(MENU_MEDIA_BUCKET, path);
  },
};

