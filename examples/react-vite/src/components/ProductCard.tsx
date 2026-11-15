import { Button } from "./Button";

export type ProductCardProps = {
  emoji?: string;
  name?: string;
  description?: string;
  price?: string;
};

export const ProductCard = ({
  emoji = "🎧",
  name = "Wireless Headphones",
  description = "Noise cancelling, 30-hour battery life.",
  price = "$199",
}: ProductCardProps) => (
  <article aria-label={name} className="card" data-testid="product-card">
    <div aria-hidden="true" className="product__image">
      {emoji}
    </div>
    <h2>{name}</h2>
    <p>{description}</p>
    <div className="product__price">{price}</div>
    <div className="actions">
      <Button variant="secondary">Add to wishlist</Button>
      <Button>Add to cart</Button>
    </div>
  </article>
);
