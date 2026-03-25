'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Editor } from '@tiptap/core';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import SettingsPanel from './SettingsPanel';

export interface RichTextImagePopoverProps {
  editor: Editor;
  trigger: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disabled?: boolean;
}

export default function RichTextImagePopover({
  editor,
  trigger,
  open,
  onOpenChange,
  disabled = false,
}: RichTextImagePopoverProps) {
  const [altText, setAltText] = useState('');
  const [widthValue, setWidthValue] = useState('');
  const [heightValue, setHeightValue] = useState('');
  const [savedPos, setSavedPos] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const altTextRef = useRef(altText);
  const savedPosRef = useRef(savedPos);
  const widthRef = useRef(widthValue);
  const heightRef = useRef(heightValue);
  altTextRef.current = altText;
  savedPosRef.current = savedPos;
  widthRef.current = widthValue;
  heightRef.current = heightValue;

  const saveAttrsAtPos = useCallback((pos: number, attrs: { alt: string; width: string; height: string }) => {
    const node = editor.state.doc.nodeAt(pos);
    if (node?.type.name === 'richTextImage') {
      const newAttrs = {
        ...node.attrs,
        alt: attrs.alt,
        width: attrs.width || null,
        height: attrs.height || null,
      };
      if (
        node.attrs.alt !== newAttrs.alt ||
        node.attrs.width !== newAttrs.width ||
        node.attrs.height !== newAttrs.height
      ) {
        const tr = editor.state.tr.setNodeMarkup(pos, undefined, newAttrs);
        editor.view.dispatch(tr);
      }
    }
  }, [editor]);

  const saveAttrs = useCallback(() => {
    if (savedPosRef.current !== null) {
      saveAttrsAtPos(savedPosRef.current, {
        alt: altTextRef.current,
        width: widthRef.current,
        height: heightRef.current,
      });
    }
  }, [saveAttrsAtPos]);

  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (newOpen && disabled) return;
    if (!newOpen) saveAttrs();
    onOpenChange(newOpen);
  }, [onOpenChange, disabled, saveAttrs]);

  const handleWidthChange = useCallback((value: string) => {
    setWidthValue(value);
    if (savedPosRef.current !== null) {
      saveAttrsAtPos(savedPosRef.current, {
        alt: altTextRef.current,
        width: value,
        height: heightRef.current,
      });
    }
  }, [saveAttrsAtPos]);

  const handleHeightChange = useCallback((value: string) => {
    setHeightValue(value);
    if (savedPosRef.current !== null) {
      saveAttrsAtPos(savedPosRef.current, {
        alt: altTextRef.current,
        width: widthRef.current,
        height: value,
      });
    }
  }, [saveAttrsAtPos]);

  useEffect(() => {
    if (!open) return;

    const { selection } = editor.state;
    const node = editor.state.doc.nodeAt(selection.from);
    if (node?.type.name === 'richTextImage') {
      setAltText(node.attrs.alt || '');
      setWidthValue(node.attrs.width || '');
      setHeightValue(node.attrs.height || '');
      setSavedPos(selection.from);
    }
  }, [open, editor]);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [open]);

  return (
    <Popover
      open={open}
      onOpenChange={handleOpenChange}
    >
      <PopoverTrigger asChild>
        {trigger}
      </PopoverTrigger>

      <PopoverContent
        className="w-64 px-4 py-0"
        align="start"
        side="bottom"
        sideOffset={8}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SettingsPanel
          title="Image"
          isOpen={true}
          onToggle={() => {}}
        >
          <div className="grid grid-cols-3">
            <Label variant="muted">ALT</Label>
            <div className="col-span-2 *:w-full">
              <Input
                ref={inputRef}
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
                placeholder="Image description"
              />
            </div>
          </div>

          <div className="grid grid-cols-3">
            <Label variant="muted">Size</Label>
            <div className="col-span-2 *:w-full grid grid-cols-2 gap-2">
              <InputGroup>
                <InputGroupAddon>
                  <div className="flex">
                    <Tooltip>
                      <TooltipTrigger>
                        <Icon name="maxSize" className="size-3" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Width</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </InputGroupAddon>
                <InputGroupInput
                  stepper
                  value={widthValue}
                  onChange={(e) => handleWidthChange(e.target.value)}
                />
              </InputGroup>
              <InputGroup>
                <InputGroupAddon>
                  <div className="flex">
                    <Tooltip>
                      <TooltipTrigger>
                        <Icon name="maxSize" className="size-3 rotate-90" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Height</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </InputGroupAddon>
                <InputGroupInput
                  stepper
                  value={heightValue}
                  onChange={(e) => handleHeightChange(e.target.value)}
                />
              </InputGroup>
            </div>
          </div>
        </SettingsPanel>
      </PopoverContent>
    </Popover>
  );
}
