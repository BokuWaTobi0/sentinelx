'use client';
import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};
const greetingNow = () => {
  const hour = new Date().getHours();
  return hour < 5 || hour >= 18 ? 'Good evening' : hour < 12 ? 'Good morning' : 'Good afternoon';
};

/** Uses the viewer's local clock; the server render falls back to a neutral line so hydration never mismatches. */
export function Greeting() {
  const text = useSyncExternalStore(subscribe, greetingNow, () => 'Welcome back');
  return <p className="dx-greet">{text}</p>;
}
