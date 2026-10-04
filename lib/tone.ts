// The API has no colours for staff or products, so derive a stable one from the id
// using the palette from the design's sample data.
const STAFF_TONES = ["#6B7F4A", "#C8553D", "#A06B3E", "#3B5F8A", "#8A6BAD", "#2F7D6F", "#D4A537"];
const ITEM_TONES = ["#A8B86C", "#A06B3E", "#E9C547", "#5C3A22", "#3B2417", "#C2A07A", "#7E9956", "#B8A968", "#E5D27A", "#E0B05A", "#E8C8D8", "#7A5A3E", "#C9B89A", "#4A2E1F"];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export const staffTone = (id: string) => STAFF_TONES[hash(id) % STAFF_TONES.length];
export const itemTone = (id: string) => ITEM_TONES[hash(id) % ITEM_TONES.length];
export const glyphOf = (name: string) => (name.trim()[0] ?? "·").toUpperCase();
