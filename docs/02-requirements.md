# System Requirements

## Purpose

This document defines the functional and non-functional requirements for Golden Loom Myanmar.

## User Roles

- Customer
- Staff
- Admin

## Customer Functional Requirements

- FR-C01: The system shall allow customers to register an account and log in.
- FR-C02: The system shall allow customers to browse active sweater products.
- FR-C03: The system shall allow customers to view product details, colors, sizes, prices, stock, and preorder information.
- FR-C04: The system shall allow customers to add product variants to a cart.
- FR-C05: The system shall prevent customers from ordering an in-stock variant when its stock quantity is zero.
- FR-C06: The system shall allow customers to place an in-stock order using cash on delivery.
- FR-C07: The system shall allow customers to place a preorder with a 20% deposit.
- FR-C08: The system shall allow customers to upload deposit-payment proof for preorder orders.
- FR-C09: The system shall allow customers to choose standard delivery, express delivery, or pickup for in-stock orders.
- FR-C10: The system shall allow customers to choose an available pickup time slot.
- FR-C11: The system shall allow customers to view their own order and payment status.
- FR-C12: The system shall allow customers to request a color/size change, cancellation, or delivery reschedule.
- FR-C13: The system shall require customers to confirm cash-on-delivery orders before staff dispatches them.
- FR-C14: The system shall allow customers to submit product requests and general feedback.

## Staff Functional Requirements

- FR-S01: The system shall allow staff to create, update, and deactivate products and variants.
- FR-S02: The system shall allow staff to manage product stock.
- FR-S03: The system shall allow staff to create and manage pickup time slots.
- FR-S04: The system shall allow staff to review and confirm or reject preorder deposit payments.
- FR-S05: The system shall allow staff to update order, payment, and delivery status.
- FR-S06: The system shall allow staff to add a tracking number to an order.
- FR-S07: The system shall allow staff to approve or reject customer change and cancellation requests.
- FR-S08: The system shall allow staff to review, respond to, and update the status of customer product requests and feedback.
- FR-S09: The system shall provide a staff dashboard that shows pending deposits, orders requiring updates, and low-stock variants.

## Admin Functional Requirements

- FR-A01: The system shall allow admin users to perform all customer and staff actions.
- FR-A02: The system shall allow admin users to create, update, deactivate, and manage staff accounts.
- FR-A03: The system shall allow admin users to manage customer accounts.
- FR-A04: The system shall allow admin users to view all products, payments, and orders.
- FR-A05: The system shall provide an admin dashboard that summarizes orders, sales, payments, stock, and customer requests.

## System Functional Requirements

- FR-Y01: The system shall calculate a preorder deposit as 20% of the order subtotal.
- FR-Y02: The system shall calculate and save the delivery fee for each order.
- FR-Y03: The system shall separate in-stock and preorder products into different orders during checkout.
- FR-Y04: The system shall send email notifications for order creation, deposit confirmation, and tracking updates.
- FR-Y05: The system shall record staff/admin actions for payment confirmation and order changes.

## Non-Functional Requirements

- NFR-01: The application shall use React, Node.js, Express, and MySQL.
- NFR-02: The backend shall provide a REST API.
- NFR-03: The user interface shall work on desktop and mobile screens.
- NFR-04: The system shall validate user input before saving data.
- NFR-05: The final system shall use authentication and role-based authorization.
- NFR-06: Prices, deposits, and delivery fees shall use decimal values.

## Development Phases

Phase 1 will implement the core API and shared management dashboard without authentication or role-based authorization.

Phase 2 will add JWT authentication and separate permissions for customer, staff, and admin roles.
