export interface GalleryItem {
  id: string;
  src: string;
  alt: string;
  effect: string; // css class of the frame
  name: string; // display name of the effect
  description: string;
  wrapped?: boolean; // needs an .inner wrapper around the img
  signature?: boolean; // the primary requested effect
  polaroid?: boolean;
}

const img = (id: number, ext = "jpeg") =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.${ext}?auto=compress&cs=tinysrgb&fit=crop&h=560&w=840`;

export const gallery: GalleryItem[] = [
  {
    id: "cushion-dark",
    src: img(26926327),
    alt: "Machapuchare mountain in clouds",
    effect: "fx-cushion-dark",
    name: "Cushion 3D · Dark Rim",
    description: "Rounded corners, darkened edges & top light — stretched over a soft cube.",
    signature: true,
  },
  {
    id: "pillow-light",
    src: img(6915292),
    alt: "Mountain silhouette at sunset",
    effect: "fx-pillow-light",
    name: "Pillow 3D · Light Rim",
    description: "The inverse: edges brighten and catch light like frosted volume.",
    signature: true,
  },
  {
    id: "deep-vignette",
    src: img(675257),
    alt: "Rocky mountain at sunset",
    effect: "fx-deep-vignette",
    name: "Deep Vignette",
    description: "Heavy cinematic falloff pulling the eye to the center.",
  },
  {
    id: "glass",
    src: img(31665026),
    alt: "Dolomites mountain range",
    effect: "fx-glass",
    name: "Glass Gloss",
    description: "A glossy sheen sweeps across the surface — the shine moves on hover.",
  },
  {
    id: "bevel",
    src: img(15215323),
    alt: "Snowcapped mountain range",
    effect: "fx-bevel",
    name: "Bevel Cube",
    description: "Chiseled edges lit from the top-left, like print on a block.",
  },
  {
    id: "tilt",
    src: img(18362213),
    alt: "Coastal cityscape aerial view",
    effect: "fx-tilt",
    name: "Floating Tilt",
    description: "Hangs in 3D perspective and levels out when you hover.",
  },
  {
    id: "neon",
    src: img(26569628),
    alt: "Colorful cobblestone street",
    effect: "fx-neon",
    name: "Neon Aura",
    description: "Cyan-to-violet glow halo that flares up on hover.",
  },
  {
    id: "sunken",
    src: img(31440606),
    alt: "Istanbul skyline through red buildings",
    effect: "fx-sunken",
    name: "Sunken Window",
    description: "Recessed into the page — a window cut into the canvas.",
  },
  {
    id: "polaroid",
    src: img(704822),
    alt: "Autumn road by the ocean",
    effect: "fx-polaroid-wrap",
    name: "Polaroid",
    description: "Instant-print border with a casual tilt that straightens on hover.",
    wrapped: true,
    polaroid: true,
  },
  {
    id: "metal",
    src: img(36036734),
    alt: "Basque riverside buildings",
    effect: "fx-metal-wrap",
    name: "Metallic Rim",
    description: "Brushed-gold conic ring with a sunken inner pane.",
    wrapped: true,
  },
  {
    id: "curl",
    src: img(10452679),
    alt: "Colorful coastal town houses",
    effect: "fx-curl",
    name: "Lifted Curl",
    description: "Paper print with curled-corner shadows lifting off the page.",
    wrapped: true,
  },
  {
    id: "matte",
    src: img(38623924),
    alt: "Montevideo coastal skyline",
    effect: "fx-matte-wrap",
    name: "Vintage Matte",
    description: "Warm gallery mat, sepia wash and a shadowed inner frame.",
    wrapped: true,
  },
];
