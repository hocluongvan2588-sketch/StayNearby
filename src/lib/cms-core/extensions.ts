'use client';

import { Node, mergeAttributes, type AnyExtension } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { CharacterCount, Placeholder } from '@tiptap/extensions';
import { TableKit } from '@tiptap/extension-table/kit';
import { BackgroundColor, Color, TextStyle } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import Image from '@tiptap/extension-image';
import Youtube from '@tiptap/extension-youtube';
import {
  CalloutNodeView,
  ColumnsNodeView,
  CtaButtonNodeView,
  FaqGroupNodeView,
  GalleryNodeView,
  RelatedArticlesNodeView,
  TocBlockNodeView,
} from '@/components/cms-editor/StandardBlockViews';

export const CmsImageExtension = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      mediaId: { default: null },
      caption: { default: '' },
      credit: { default: '' },
    };
  },
});

export const CalloutExtension = Node.create({
  name: 'callout',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      tone: { default: 'info' },
      title: { default: '' },
      body: { default: '' },
    };
  },
  parseHTML() {
    return [{ tag: 'aside[data-cms-block="callout"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['aside', mergeAttributes(HTMLAttributes, { 'data-cms-block': 'callout' })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(CalloutNodeView);
  },
});

export const FaqGroupExtension = Node.create({
  name: 'faqGroup',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      title: { default: 'Frequently Asked Questions' },
      items: {
        default: [
          {
            question: 'What is included in a monthly stay?',
            answer: 'High-speed Wi-Fi, utility clarity, and verified neighborhood amenities.',
          },
        ],
      },
    };
  },
  parseHTML() {
    return [{ tag: 'section[data-cms-block="faqGroup"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['section', mergeAttributes(HTMLAttributes, { 'data-cms-block': 'faqGroup' })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(FaqGroupNodeView);
  },
});

export const CtaButtonExtension = Node.create({
  name: 'ctaButton',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      label: { default: 'Browse verified stays' },
      url: { default: '/stays' },
      variant: { default: 'primary' },
      align: { default: 'left' },
      newTab: { default: false },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-cms-block="ctaButton"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-cms-block': 'ctaButton' })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(CtaButtonNodeView);
  },
});

export const ColumnsExtension = Node.create({
  name: 'columns',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      columns: { default: 2 },
      items: {
        default: [
          { heading: 'Highlight 1', body: 'Details...' },
          { heading: 'Highlight 2', body: 'Details...' },
        ],
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-cms-block="columns"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-cms-block': 'columns' })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ColumnsNodeView);
  },
});

export const GalleryExtension = Node.create({
  name: 'gallery',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      layout: { default: 'grid' },
      items: { default: [] },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-cms-block="gallery"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-cms-block': 'gallery' })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(GalleryNodeView);
  },
});

export const TocBlockExtension = Node.create({
  name: 'tocBlock',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      title: { default: 'In this guide' },
      maxDepth: { default: 3 },
    };
  },
  parseHTML() {
    return [{ tag: 'nav[data-cms-block="tocBlock"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['nav', mergeAttributes(HTMLAttributes, { 'data-cms-block': 'tocBlock' })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(TocBlockNodeView);
  },
});

export const RelatedArticlesExtension = Node.create({
  name: 'relatedArticles',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      title: { default: 'Related Guides' },
      items: { default: [] },
    };
  },
  parseHTML() {
    return [{ tag: 'aside[data-cms-block="relatedArticles"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['aside', mergeAttributes(HTMLAttributes, { 'data-cms-block': 'relatedArticles' })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(RelatedArticlesNodeView);
  },
});

export function createStandardCmsExtensions(options?: {
  placeholder?: string;
  extraExtensions?: AnyExtension[];
}): AnyExtension[] {
  const base: AnyExtension[] = [
    StarterKit.configure({
      // H1 is strictly reserved for page title above the editor canvas
      heading: { levels: [2, 3, 4, 5, 6] },
      link: {
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
      },
    }),
    TextStyle,
    Color,
    BackgroundColor,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    TableKit.configure({
      table: { resizable: true },
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    CmsImageExtension.configure({
      inline: false,
      allowBase64: false,
    }),
    Youtube.configure({
      nocookie: true,
      modestBranding: true,
    }),
    Placeholder.configure({
      placeholder:
        options?.placeholder ?? 'Start writing, or type "/" to insert a block...',
    }),
    CharacterCount,
    CalloutExtension,
    FaqGroupExtension,
    CtaButtonExtension,
    ColumnsExtension,
    GalleryExtension,
    TocBlockExtension,
    RelatedArticlesExtension,
  ];

  if (options?.extraExtensions && options.extraExtensions.length > 0) {
    base.push(...options.extraExtensions);
  }
  return base;
}
