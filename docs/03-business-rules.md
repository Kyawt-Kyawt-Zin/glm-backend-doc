# Business Rules

## Purpose

This document defines the business rules that control how Golden Loom Myanmar works.

## Product and Variant Rules

- BR-P01: Each product variant shall have one color and one size.
- BR-P02: Free-size products shall use `Free Size` as their size value.
- BR-P03: A product cannot have two variants with the same color and size.
- BR-P04: Price, stock quantity, preorder availability, and deposit details belong to the product variant.
- BR-P05: A customer cannot order an inactive product or variant.
- BR-P06: Stock quantity shall never be less than zero.

## Cart and Order Rules

- BR-O01: A cart may contain in-stock and preorder products, but the system shall create separate orders for each fulfillment type during checkout.
- BR-O02: The system shall check stock availability again during checkout.
- BR-O03: An in-stock order with cash on delivery shall begin with `awaiting_customer_confirmation`.
- BR-O04: A preorder shall begin with `awaiting_deposit`.
- BR-O05: An order shall save product name, color, size, price, and delivery fee as snapshots at the time of checkout.

## Preorder and Payment Rules

- BR-PY01: A preorder deposit shall be 20% of the preorder subtotal.
- BR-PY02: A preorder payment proof shall be reviewed by staff or admin.
- BR-PY03: A deposit payment may be `submitted`, `confirmed`, or `rejected`.
- BR-PY04: A preorder shall become `confirmed` only after staff/admin confirms the deposit.
- BR-PY05: A cash-on-delivery payment shall be marked as collected only after successful delivery.

## Delivery and Pickup Rules

- BR-D01: Standard delivery is for in-stock orders and has an estimated delivery time of about three days.
- BR-D02: Express delivery is for in-stock orders and has an estimated delivery time of the same day or within 24 hours.
- BR-D03: Delivery fees shall depend on the selected delivery method and be saved with the order.
- BR-D04: Pickup is available only when the customer selects an active pickup time slot with remaining capacity.
- BR-D05: A preorder customer selects delivery or pickup after the product arrives and becomes ready for delivery.

## Change and Cancellation Rules

- BR-CC01: Customers cannot directly edit a confirmed order.
- BR-CC02: Customers may submit a request to change color/size, cancel an order, or reschedule delivery.
- BR-CC03: Staff or admin shall approve or reject every change or cancellation request.
- BR-CC04: A confirmed preorder deposit may be refundable or non-refundable according to the business decision made by staff or admin.

## Role Rules

- BR-R01: Customers may access only their own cart, orders, payments, and requests.
- BR-R02: Staff may manage products, stock, orders, payments, pickup slots, and customer requests.
- BR-R03: Admin users may perform all customer and staff actions and manage staff accounts.

## Notification Rules

- BR-N01: The system shall send an email when an order is created.
- BR-N02: The system shall send an email when a deposit is confirmed or rejected.
- BR-N03: The system shall send an email when tracking or delivery status changes.

## Customer Feedback and Product Request Rules

- BR-F01: Customers may submit a product request or general feedback.
- BR-F02: Customer requests shall begin with the status `new`.
- BR-F03: Staff or admin may update a request to `reviewing`, `planned`, `fulfilled`, or `rejected`.
- BR-F04: Customer feedback and requests shall be available to staff and admin only.
