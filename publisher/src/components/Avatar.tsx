"use client";
import { useState } from "react";

export function Avatar({ user, size = 40, className = "" }: { user: { id: string; firstName: string; lastName: string; avatarUpdatedAt: string | Date | null }; size?: number; className?: string }) {
  const [broken, setBroken] = useState(false);
  const initials = `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase() || "?";
  const v = user.avatarUpdatedAt ? new Date(user.avatarUpdatedAt).getTime() : 0;
  return user.avatarUpdatedAt && !broken ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img key={v} src={`/api/avatar/${user.id}?v=${v}`} alt={`${user.firstName}'s profile photo`} onError={() => setBroken(true)} className={`shrink-0 rounded-full object-cover ${className}`} style={{ width: size, height: size }} />
  ) : (
    <span aria-label={`${user.firstName} ${user.lastName}`} className={`grid shrink-0 place-items-center rounded-full bg-primary font-semibold text-primary-fg ${className}`} style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {initials}
    </span>
  );
}
