import { MiniMoth } from '@minimoth/sdk-node'

const mm = new MiniMoth({
  apiKey: process.env.MINIMOTH_API_KEY,  // mm_live_...
})

export default mm;
