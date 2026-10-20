import api from "@/lib/api";

/** What the server found in an import file, and whether it wrote it. */
export interface ImportReport {
    dryRun: boolean;
    host: string;
    exportedAt?: string;
    collections: { name: string; documents: number }[];
    skipped: string[];
    errors: string[];
    blockers: string[];
    imported: boolean;
}

export const exportDatabase = async (): Promise<Blob> => {
    const response = await api.get('/database/export', { responseType: 'blob' });
    return response.data;
};

export const importDatabase = async ({
    file,
    password,
    confirm,
    dryRun,
}: {
    file: File;
    password: string;
    /** The store's host, typed by the admin. */
    confirm: string;
    dryRun: boolean;
}): Promise<ImportReport> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('password', password);
    formData.append('confirm', confirm);
    formData.append('dryRun', String(dryRun));
    const response = await api.post('/database/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
};
