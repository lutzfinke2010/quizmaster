import { useState } from "react";
import avatars from "../../domain/avatars.json";

const avatarById = new Map(avatars.avatars.map((avatar) => [avatar.id, avatar]));

export function Avatar({ avatarId, className = "" }: { avatarId: string; className?: string }) {
  const [failedId, setFailedId] = useState<string | null>(null);
  const avatar = avatarById.get(avatarId);
  if (!avatar || failedId === avatarId) {
    return <svg className={`rl-avatar is-fallback ${className}`.trim()} viewBox="0 0 64 64" aria-hidden="true">
      <rect x="3" y="3" width="58" height="58" rx="18" fill="#eaf6dc" stroke="#b9e39a" strokeWidth="2" />
      <path d="M22 28h.01M42 28h.01M23 41c5 5 13 5 18 0" fill="none" stroke="#2a463c" strokeWidth="4" strokeLinecap="round" />
    </svg>;
  }
  const path256 = `${import.meta.env.BASE_URL}${avatar.path256}`;
  const path512 = `${import.meta.env.BASE_URL}${avatar.path512}`;
  return <img className={`rl-avatar ${className}`.trim()} src={path256} srcSet={`${path256} 1x, ${path512} 2x`} alt=""
    aria-hidden="true" onError={() => setFailedId(avatarId)} />;
}
