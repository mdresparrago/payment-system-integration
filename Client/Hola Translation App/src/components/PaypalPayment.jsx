import React from "react";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";

const PaypalPayment = () => {
  const initialOptions = {
    "client-id": import.meta.env.VITE_PAYPAL_CLIENT_ID,
    currency: "USD", // Added back the required currency option
  };

  const styles = {
    layout: "vertical",
    shape: "rect",
    // You can add more styles like color: "blue", label: "pay" if needed
  };

  const onCreateOrder = async () => {
    try {
      const response = await fetch("/paypal/createorder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error(
          "Frontend: Backend responded with error status for createOrder:",
          response.status,
          errorData
        );
        throw new Error(
          `Failed to create order on server: ${response.status} - ${
            errorData.error || "Unknown error"
          }`
        );
      }

      const responseData = await response.json();
      console.log("Frontend: Backend response for createOrder:", responseData);

      // FIX: Access the order ID from the nested 'order' object as per backend response
      if (responseData.order && responseData.order.id) {
        return responseData.order.id;
      } else {
        console.error(
          "Frontend: Invalid order ID structure received from backend:",
          responseData
        );
        throw new Error(
          "Invalid order ID received from backend. Expected 'order.id'."
        );
      }
    } catch (error) {
      console.error("Frontend: Error creating PayPal order:", error);
      throw error; // Re-throw so PayPalButtons can catch and display an error
    }
  };

  const onApprove = async (data) => {
    try {
      console.log("Order approved, capturing payment...");
      if (!data?.orderID) {
        console.error(
          "Frontend: Order ID not found in PayPal data for onApprove."
        );
        throw new Error("Order ID not found from PayPal data");
      }

      // FIX: Change method to "POST" to match backend capture route
      const response = await fetch(`/paypal/capturepayment/${data.orderID}`, {
        method: "POST", // This needs to be POST
        headers: {
          "Content-Type": "application/json",
        },
        // If your backend's capture endpoint expects a body (e.g., payerId), add it here:
        // body: JSON.stringify({ payerId: data.payerID }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error(
          "Frontend: Backend responded with error status for capturePayment:",
          response.status,
          errorData
        );
        throw new Error(
          `Failed to capture payment on server: ${response.status} - ${
            errorData.error || "Unknown error"
          }`
        );
      }

      const result = await response.json();
      console.log("Frontend: Payment captured successfully:", result);
      window.location.href = "/complete-payment"; // Redirect on success
    } catch (error) {
      console.error("Frontend: Error verifying/capturing PayPal order:", error);
      window.location.href = "/cancel-payment"; // Redirect to cancel on any error during capture
    }
  };

  const onError = (error) => {
    console.error("Frontend: PayPal Buttons encountered an error:", error);
    // Replace with a custom notification/modal instead of direct redirect for user feedback
    window.location.href = "/cancel-payment"; // Redirect for generic PayPal errors
  };

  return (
    <PayPalScriptProvider options={initialOptions}>
      <PayPalButtons
        styles={styles}
        createOrder={onCreateOrder}
        onApprove={onApprove}
        onError={onError}
        // fundingSource="paypal" // Uncomment if you want to explicitly show only PayPal
      />
    </PayPalScriptProvider>
  );
};

export default PaypalPayment;
