// validation.js

import { logger } from './logger.js';

export function validateNumber(value: unknown, fieldName = 'number'): number | null {
  if (typeof value !== 'number' || isNaN(value)) {
    logger.warn(`[VALIDATION] ${fieldName} must be a valid number, got ${value}`);
    return null;
  }
  
  if (value < 0) {
    logger.warn(`[VALIDATION] ${fieldName} cannot be negative`);
    return null;
  }
  
  return value;
}

export function validateDiscordId(value: unknown, fieldName = 'ID'): string | null {
  if (typeof value !== 'string') {
    logger.warn(`[VALIDATION] ${fieldName} must be a string`);
    return null;
  }

  if (!/^\d{18,20}$/.test(value)) {
    logger.warn(`[VALIDATION] Invalid ${fieldName} format`);
    return null;
  }
  
  return value;
}

export function sanitizeMarkdown(text: unknown): string {
  if (typeof text !== 'string') return '';
  
  return text
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/`/g, '\\`')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\|/g, '\\|')
    .replace(/~/g, '\\~');
}

export function sanitizeInput(input: unknown, maxLength = 2000): string {
  if (typeof input !== 'string') return '';
  
  return input
    .trim()
    .substring(0, maxLength)
    .replace(/[\x00-\x1F\x7F]/g, '');
}