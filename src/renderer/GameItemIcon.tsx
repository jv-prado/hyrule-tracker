import type { TrackedItem } from '../shared/types';
import assets from './item-images.json';

const images: Record<string, { file: string }> = assets;

export function itemImage(id: string) {
  return images[id]?.file;
}

const groupIcons: Record<string, string> = { chests: 'chest', bean_spots: 'magic_bean', big_poe_spots: 'big_poe' };

export function trackedItemIcon(item: TrackedItem) {
  const [group, itemId] = item.id.split('.');
  return images[itemId] ? itemId : groupIcons[group] ?? item.iconId;
}

export function GameItemIcon({ id, size = 24 }: { id?: string; size?: number }) {
  const file = id && itemImage(id);
  if (!file) return null;
  return <img className="game-item-icon" src={file} width={size} height={size} alt="" draggable={false} />;
}
