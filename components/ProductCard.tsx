{
  product.imageUrl ? (
    <img
      src={product.imageUrl}
      alt={product.name}
      className="w-full h-40 object-cover"
      loading="lazy"
    />
  ) : null;
}
