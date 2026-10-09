"use client";

/**
 * Developer-details mode: when enabled the UI keeps showing every technical
 * section (validation gate details, container/codec internals, hashes,
 * evidence rows). When off, normal users see only the plain-language card.
 *
 * Same external-store pattern as the language store: the preference lives in
 * localStorage, exposed through `useSyncExternalStore` so SSR always renders
 * the simple view and hydration stays consistent.
 */

import * as React from "react";

const STORAGE_KEY = "toolt-dev";

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(): void {
  for (const listener of listeners) listener();
}

function clientSnapshot(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function serverSnapshot(): boolean {
  return false;
}

export function setDevMode(next: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  } catch {
    // storage unavailable - still applies for this session via notify()
  }
  notify();
}

export function useDevMode(): boolean {
  return React.useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
}
