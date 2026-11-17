import type { ReactNode } from 'react';

export function ObjectiveName({ done, children }: { done?: boolean; children: ReactNode }) {
  return done ? <s className="completed-title">{children}</s> : <>{children}</>;
}
