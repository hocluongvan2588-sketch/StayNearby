'use client';

import { Node, mergeAttributes, type AnyExtension } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import {
  VnDestinationCardNodeView,
  VnDestinationMapNodeView,
  VnLocalPartnerOfferNodeView,
  VnLocalPlaceCardNodeView,
  VnNeighborhoodCardNodeView,
  VnPromotionBlockNodeView,
  VnRecommendedStaysNodeView,
  VnRelatedGuidesNodeView,
  VnStayListingNodeView,
  VnStaySearchWidgetNodeView,
} from '@/components/cms-editor/VietNomadBlockViews';

export const VnStayListingExtension = Node.create({
  name: 'vnStayListing',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      stayId: { default: '' },
      label: { default: '' },
      layout: { default: 'highlight' },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-vn-block="vnStayListing"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-vn-block': 'vnStayListing' })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(VnStayListingNodeView);
  },
});

export const VnDestinationCardExtension = Node.create({
  name: 'vnDestinationCard',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      destinationId: { default: '' },
      label: { default: '' },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-vn-block="vnDestinationCard"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-vn-block': 'vnDestinationCard' })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(VnDestinationCardNodeView);
  },
});

export const VnNeighborhoodCardExtension = Node.create({
  name: 'vnNeighborhoodCard',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      neighborhoodId: { default: '' },
      label: { default: '' },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-vn-block="vnNeighborhoodCard"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-vn-block': 'vnNeighborhoodCard' })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(VnNeighborhoodCardNodeView);
  },
});

export const VnLocalPlaceCardExtension = Node.create({
  name: 'vnLocalPlaceCard',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      placeId: { default: '' },
      label: { default: '' },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-vn-block="vnLocalPlaceCard"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-vn-block': 'vnLocalPlaceCard' })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(VnLocalPlaceCardNodeView);
  },
});

export const VnDestinationMapExtension = Node.create({
  name: 'vnDestinationMap',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      destinationId: { default: '' },
      label: { default: '' },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-vn-block="vnDestinationMap"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-vn-block': 'vnDestinationMap' })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(VnDestinationMapNodeView);
  },
});

export const VnLocalPartnerOfferExtension = Node.create({
  name: 'vnLocalPartnerOffer',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      partnerId: { default: '' },
      label: { default: '' },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-vn-block="vnLocalPartnerOffer"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-vn-block': 'vnLocalPartnerOffer' })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(VnLocalPartnerOfferNodeView);
  },
});

export const VnStaySearchWidgetExtension = Node.create({
  name: 'vnStaySearchWidget',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      heading: { default: 'Find verified weekly & monthly stays' },
      defaultDestinationSlug: { default: '' },
      defaultMinNights: { default: 30 },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-vn-block="vnStaySearchWidget"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-vn-block': 'vnStaySearchWidget' })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(VnStaySearchWidgetNodeView);
  },
});

export const VnRecommendedStaysExtension = Node.create({
  name: 'vnRecommendedStays',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      title: { default: 'Recommended Long-Stay Homes' },
      destinationSlug: { default: '' },
      lifestyleSlug: { default: '' },
      workReadyOnly: { default: false },
      limit: { default: 2 },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-vn-block="vnRecommendedStays"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-vn-block': 'vnRecommendedStays' })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(VnRecommendedStaysNodeView);
  },
});

export const VnRelatedGuidesExtension = Node.create({
  name: 'vnRelatedGuides',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      title: { default: 'Related Guides' },
      destinationSlug: { default: '' },
      categorySlug: { default: '' },
      contentIds: { default: [] },
      limit: { default: 2 },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-vn-block="vnRelatedGuides"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-vn-block': 'vnRelatedGuides' })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(VnRelatedGuidesNodeView);
  },
});

export const VnPromotionBlockExtension = Node.create({
  name: 'vnPromotionBlock',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      promotionId: { default: '' },
      label: { default: '' },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-vn-block="vnPromotionBlock"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-vn-block': 'vnPromotionBlock' })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(VnPromotionBlockNodeView);
  },
});

export function createVietNomadBlockExtensions(): AnyExtension[] {
  return [
    VnStayListingExtension,
    VnDestinationCardExtension,
    VnNeighborhoodCardExtension,
    VnLocalPlaceCardExtension,
    VnDestinationMapExtension,
    VnLocalPartnerOfferExtension,
    VnStaySearchWidgetExtension,
    VnRecommendedStaysExtension,
    VnRelatedGuidesExtension,
    VnPromotionBlockExtension,
  ];
}
