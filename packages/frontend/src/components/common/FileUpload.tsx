import { useCallback, useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Upload, X, FileText, Loader2 } from 'lucide-react';
import { useUploadFiles, useAttachments, useDeleteAttachment, getDownloadUrl } from '@/api/attachments';
import { format } from 'date-fns';

interface Props {
  taskId: string;
}

export default function FileUpload({ taskId }: Props) {
  const { data: attachments } = useAttachments(taskId);
  const uploadMut = useUploadFiles(taskId);
  const deleteMut = useDeleteAttachment(taskId);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) {
      uploadMut.mutate(e.dataTransfer.files);
    }
  }, [uploadMut]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadMut.mutate(e.target.files);
      e.target.value = '';
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isImage = (mimeType: string) => mimeType.startsWith('image/');

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-muted-foreground">
        Attachments {attachments ? `(${attachments.length})` : ''}
      </h4>

      {/* Drop zone */}
      <div
        className={cn(
          'relative rounded-lg border-2 border-dashed p-4 text-center transition-colors cursor-pointer',
          dragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-muted-foreground/50',
          uploadMut.isPending && 'opacity-50 pointer-events-none',
        )}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleChange}
        />
        {uploadMut.isPending ? (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Uploading...
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">
            <Upload className="w-5 h-5 mx-auto mb-1" />
            <p>Drop files here or click to browse</p>
            <p className="mt-0.5">Max 10MB per file</p>
          </div>
        )}
      </div>

      {/* File list */}
      {attachments && attachments.length > 0 && (
        <div className="space-y-1">
          {attachments.map((att) => (
            <div key={att.id} className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 group text-sm">
              {isImage(att.mimeType) ? (
                <img src={getDownloadUrl(att.id)} alt={att.fileName} className="w-8 h-8 rounded object-cover" />
              ) : (
                <FileText className="w-8 h-8 text-muted-foreground p-1" />
              )}
              <a
                href={getDownloadUrl(att.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-0"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="truncate text-xs font-medium">{att.fileName}</p>
                <p className="text-[10px] text-muted-foreground">
                  {formatSize(att.fileSize)} · {format(new Date(att.createdAt), 'MMM d')}
                </p>
              </a>
              <button
                onClick={(e) => { e.stopPropagation(); deleteMut.mutate(att.id); }}
                className="p-0.5 hover:bg-destructive/10 rounded opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
