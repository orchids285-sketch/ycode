'use client';

import React, { useState } from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import SettingsPanel from './SettingsPanel';
import type { Collection, Layer, SiteSearchSettings as SiteSearchSettingsType } from '@/types';

interface SiteSearchSettingsProps {
  layer: Layer | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
  collections: Collection[];
}

const DEFAULT_SETTINGS: SiteSearchSettingsType = {
  scope: 'site',
  placeholder: 'Search...',
  shortcut: true,
};

/** Settings panel for the Site Search element: scope, placeholder, and shortcut. */
export default function SiteSearchSettings({ layer, onLayerUpdate, collections }: SiteSearchSettingsProps) {
  const [isOpen, setIsOpen] = useState(true);

  if (!layer || layer.name !== 'siteSearch') {
    return null;
  }

  const search = { ...DEFAULT_SETTINGS, ...layer.settings?.search };

  const updateSearch = (updates: Partial<SiteSearchSettingsType>) => {
    onLayerUpdate(layer.id, {
      settings: {
        ...layer.settings,
        search: { ...search, ...updates },
      },
    });
  };

  return (
    <SettingsPanel
      title="Search"
      isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
    >
      <div className="grid grid-cols-3 items-center">
        <Label variant="muted">Scope</Label>
        <div className="col-span-2 *:w-full">
          <Select
            value={search.scope}
            onValueChange={(val) => updateSearch({ scope: val as SiteSearchSettingsType['scope'] })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="site">Whole site</SelectItem>
                <SelectItem value="paths">Specific paths</SelectItem>
                <SelectItem value="collection">Single collection</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      {search.scope === 'paths' && (
        <div className="grid grid-cols-3 items-center">
          <Label variant="muted">Paths</Label>
          <div className="col-span-2 *:w-full">
            <Input
              value={(search.paths ?? []).join(', ')}
              placeholder="/blog, /docs"
              onChange={(e) =>
                updateSearch({
                  paths: e.target.value
                    .split(',')
                    .map((p) => p.trim())
                    .filter(Boolean),
                })
              }
            />
          </div>
        </div>
      )}

      {search.scope === 'collection' && (
        <div className="grid grid-cols-3 items-center">
          <Label variant="muted">Collection</Label>
          <div className="col-span-2 *:w-full">
            <Select
              value={search.collectionId ?? ''}
              onValueChange={(val) => updateSearch({ collectionId: val })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select collection" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {collections.map((collection) => (
                    <SelectItem key={collection.id} value={collection.id}>
                      {collection.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 items-center">
        <Label variant="muted">Placeholder</Label>
        <div className="col-span-2 *:w-full">
          <Input
            value={search.placeholder ?? ''}
            placeholder="Search..."
            onChange={(e) => updateSearch({ placeholder: e.target.value })}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Label variant="muted">Enable ⌘K shortcut</Label>
        <Checkbox
          checked={search.shortcut ?? true}
          onCheckedChange={(checked) => updateSearch({ shortcut: checked === true })}
        />
      </div>
    </SettingsPanel>
  );
}
