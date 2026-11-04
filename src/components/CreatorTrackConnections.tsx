'use client';

import { useState } from 'react';
import FlowRelationships from '@/components/flow/FlowRelationships';

export default function CreatorTrackConnections({ trackId }: { trackId: string }) {
  const [open, setOpen] = useState(false);
  return <details className="creator-track-connections" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Explore this recording’s connections</summary>
    {open ? <FlowRelationships kind="track" id={trackId} compact /> : null}
  </details>;
}
