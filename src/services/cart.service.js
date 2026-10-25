import * as Response from "../config/response.helper.js";
import * as cartRepository from "../repositories/cart.repository.js";

const isPositiveInteger = (value) => {
  return Number.isInteger(Number(value)) && Number(value) > 0;
};

const buildCartData = async (cart) => {
  if (!cart) {
    return {
      cart: null,
      items: [],
      summary: {
        unique_items: 0,
        total_quantity: 0,
        subtotal: 0,
      },
    };
  }

  const cartItems = await cartRepository.getCartItemsByCartId(cart.id);

  let subtotal = 0;
  let totalQuantity = 0;

  const items = cartItems.map((item) => {
    const price = Number(item.price);
    const lineTotal = price * item.quantity;

    subtotal += lineTotal;
    totalQuantity += item.quantity;

    return {
      ...item,
      price,
      deposit_percentage: Number(item.deposit_percentage),
      line_total: lineTotal,
    };
  });

  return {
    cart,
    items,
    summary: {
      unique_items: items.length,
      total_quantity: totalQuantity,
      subtotal,
    },
  };
};

export const getMyCart = async (userId) => {
  try {
    const cart = await cartRepository.findActiveCartByUserId(userId);
    const cartData = await buildCartData(cart);

    return Response.success(cartData, "Cart fetched successfully");
  } catch (error) {
    console.error("getMyCart service error:", error.message);

    return Response.internalServerError("Unable to fetch cart");
  }
};

export const addItemToCart = async (
  userId,
  { productVariantId, quantity = 1 },
) => {
  const variantId = Number(productVariantId);
  const requestedQuantity = Number(quantity);

  if (!isPositiveInteger(variantId) || !isPositiveInteger(requestedQuantity)) {
    return Response.badRequest(
      "Product variant ID and quantity must be positive whole numbers",
    );
  }

  try {
    const variant = await cartRepository.findAvailableVariantById(variantId);

    if (!variant) {
      return Response.notFound("Product variant is not available");
    }

    let cart = await cartRepository.findActiveCartByUserId(userId);

    if (!cart) {
      cart = await cartRepository.createCart(userId);
    }

    const existingItem = await cartRepository.findCartItemByCartAndVariant(
      cart.id,
      variantId,
    );

    const finalQuantity = existingItem
      ? existingItem.quantity + requestedQuantity
      : requestedQuantity;

    if (
      variant.fulfillment_type === "in_stock" &&
      Number(variant.stock_quantity) < finalQuantity
    ) {
      return Response.badRequest("Requested quantity exceeds available stock");
    }

    if (existingItem) {
      await cartRepository.updateCartItemQuantity(
        existingItem.id,
        finalQuantity,
      );
    } else {
      await cartRepository.createCartItem(
        cart.id,
        variantId,
        requestedQuantity,
      );
    }

    const cartData = await buildCartData(cart);

    return Response.created(cartData, "Item added to cart successfully");
  } catch (error) {
    console.error("addItemToCart service error:", error.message);

    return Response.internalServerError("Unable to add item to cart");
  }
};

export const updateMyCartItem = async (userId, itemId, { quantity }) => {
  const cartItemId = Number(itemId);
  const requestedQuantity = Number(quantity);

  if (!isPositiveInteger(cartItemId) || !isPositiveInteger(requestedQuantity)) {
    return Response.badRequest(
      "Cart item ID and quantity must be positive whole numbers",
    );
  }

  try {
    const cartItem = await cartRepository.findActiveCartItemByIdAndUserId(
      cartItemId,
      userId,
    );

    if (!cartItem) {
      return Response.notFound("Cart item not found");
    }

    const variant = await cartRepository.findAvailableVariantById(
      cartItem.product_variant_id,
    );

    if (!variant) {
      return Response.badRequest(
        "This product variant is no longer available. Remove it from the cart.",
      );
    }

    if (
      variant.fulfillment_type === "in_stock" &&
      Number(variant.stock_quantity) < requestedQuantity
    ) {
      return Response.badRequest("Requested quantity exceeds available stock");
    }

    await cartRepository.updateCartItemQuantity(cartItemId, requestedQuantity);

    const cart = await cartRepository.findActiveCartByUserId(userId);
    const cartData = await buildCartData(cart);

    return Response.success(cartData, "Cart item updated successfully");
  } catch (error) {
    console.error("updateMyCartItem service error:", error.message);

    return Response.internalServerError("Unable to update cart item");
  }
};

export const removeMyCartItem = async (userId, itemId) => {
  const cartItemId = Number(itemId);

  if (!isPositiveInteger(cartItemId)) {
    return Response.badRequest("Cart item ID must be a positive whole number");
  }

  try {
    const cartItem = await cartRepository.findActiveCartItemByIdAndUserId(
      cartItemId,
      userId,
    );

    if (!cartItem) {
      return Response.notFound("Cart item not found");
    }

    await cartRepository.deleteCartItem(cartItemId);

    const cart = await cartRepository.findActiveCartByUserId(userId);
    const cartData = await buildCartData(cart);

    return Response.success(cartData, "Cart item removed successfully");
  } catch (error) {
    console.error("removeMyCartItem service error:", error.message);

    return Response.internalServerError("Unable to remove cart item");
  }
};
