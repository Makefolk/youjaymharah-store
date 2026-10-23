import { Hero } from "@/components/homepage/hero"
import { NewArrivals } from "@/components/homepage/new-arrivals"
import { Collections } from "@/components/homepage/collections"
import { ShopByWardrobe } from "@/components/homepage/shop-by-wardrobe"
import { About } from "@/components/homepage/about"

export default function Homepage() {
  return (
    <>
      <Hero />
      <ShopByWardrobe />
      <NewArrivals />
      <Collections />
      <About />
    </>
  )
}
