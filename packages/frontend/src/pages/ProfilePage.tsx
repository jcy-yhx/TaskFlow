import { useRef } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';
import { Camera, Loader2 } from 'lucide-react';
import { useState } from 'react';

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const form = new FormData();
      form.append('avatar', file);
      const { data } = await apiClient.post<{ data: { avatarUrl: string } }>('/users/me/avatar', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (user) {
        setUser({ ...user, avatarUrl: data.data.avatarUrl });
      }
      toast.success('Avatar updated');
    } catch {
      toast.error('Failed to upload avatar');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="max-w-lg mx-auto p-6 space-y-6">
      <h2 className="text-lg font-semibold">Profile</h2>

      <div className="flex items-center gap-4 p-4 rounded-lg border bg-card">
        <button
          onClick={() => fileRef.current?.click()}
          className="relative group shrink-0"
          disabled={uploading}
        >
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt="Avatar"
              className="w-16 h-16 rounded-full object-cover"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-xl font-medium">
              {user?.name?.[0]?.toUpperCase() ?? '?'}
            </div>
          )}
          <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            {uploading ? (
              <Loader2 className="w-5 h-5 text-white animate-spin" />
            ) : (
              <Camera className="w-5 h-5 text-white" />
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </button>
        <div>
          <p className="font-medium">{user?.name}</p>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
          <p className="text-xs text-muted-foreground mt-1">Click avatar to change</p>
        </div>
      </div>
    </div>
  );
}
