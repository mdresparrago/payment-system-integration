import express from "express";
import got from "got";
import dotenv from "dotenv";
import { Buffer } from "buffer"; // Explicitly import Buffer for ESM environments

dotenv.config(); // Load environment variables from .env file

const router = express.Router();

// Console logs for debugging environment variables on backend startup
console.log(
  "Backend Client ID:",
  process.env.PAYPAL_CLIENT_ID
    ? process.env.PAYPAL_CLIENT_ID.substring(0, 10) + "..."
    : "undefined"
);
console.log(
  "Backend Client Secret:",
  process.env.PAYPAL_CLIENT_SECRET ? "******" : "undefined"
); // Never log full secret
console.log("Backend PayPal Base URL:", process.env.PAYPAL_BASEURL);

const getAccesToken = async () => {
  try {
    // Base64 encode Client ID and Secret for Basic Authentication
    const auth = Buffer.from(
      `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
    ).toString("base64");

    const response = await got.post(
      `${process.env.PAYPAL_BASEURL}/v1/oauth2/token`,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${auth}`, // Correct Basic Auth format
        },
        form: {
          grant_type: "client_credentials",
        },
        // No responseType: "json" here, so `response.body` will be a string
        // which JSON.parse handles below. This is robust.
      }
    );

    console.log("Backend: PayPal Token API Raw Response Body:", response.body);
    const data = JSON.parse(response.body); // Manually parse the string response
    const newAccessToken = data.access_token;
    return newAccessToken;
  } catch (error) {
    console.error("Backend: Error getting access token from PayPal:");
    if (error.response) {
      console.error("Status:", error.response.statusCode);
      console.error("Body:", error.response.body); // Log PayPal's error response (e.g., "invalid_client")
    } else {
      console.error("Error message:", error.message);
    }
    throw new Error("Failed to get access token", { cause: error });
  }
};

const createOrder = async (req, res) => {
  try {
    const accessToken = await getAccesToken(); // Obtain access token
    console.log("Backend: Access Token obtained for order creation.");

    const response = await got.post(
      `${process.env.PAYPAL_BASEURL}/v2/checkout/orders`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        json: {
          // `json` option automatically sets Content-Type and stringifies body
          intent: "CAPTURE",
          purchase_units: [
            {
              items: [
                {
                  name: "Hola! Translation App Subscription",
                  description: "Monthly subscription for Hola! Translation App",
                  quantity: "1",
                  unit_amount: {
                    currency_code: "USD",
                    value: "9.99",
                  },
                },
              ],
              amount: {
                currency_code: "USD",
                value: "9.99",
                breakdown: {
                  item_total: {
                    currency_code: "USD",
                    value: "9.99",
                  },
                },
              },
            },
          ],
          payment_source: {
            paypal: {
              experience_context: {
                payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
                payment_method_selected: "PAYPAL",
                brand_name: "DekayHub - Volatility Grid",
                shipping_preference: "NO_SHIPPING",
                locale: "en-US",
                user_action: "PAY_NOW",
                return_url: `${process.env.PAYPAL_REDIRECT_BASEURL}/complete-payment`,
                cancel_url: `${process.env.PAYPAL_REDIRECT_BASEURL}/cancel-payment`,
              },
            },
          },
        },
        responseType: "json", // `got` will parse PayPal's response body as JSON
      }
    );

    // `response.body` is now the parsed JSON object from PayPal's successful order creation
    console.log(
      "Backend: PayPal Create Order API Response (Full Order Object):",
      response.body
    );

    // FIX: Send the entire PayPal order object back under an 'order' key
    // This matches the frontend's expectation of responseData.order.id
    return res.status(200).json({ order: response.body });
  } catch (error) {
    console.error("Backend: Failed to create PayPal order.");
    if (error.response) {
      console.error("Status:", error.response.statusCode);
      console.error("Body:", error.response.body); // Log PayPal's error response
      // Send PayPal's error back to the frontend
      res.status(error.response.statusCode || 500).json({
        error: error.response.body.message || "PayPal API Error",
        details: error.response.body.details || error.response.body,
      });
    } else {
      console.error("Error message:", error.message);
      // Send a generic internal server error if no specific PayPal response
      res.status(500).json({
        error: error.message || "Internal Error. Failed to create order",
      });
    }
  }
};

const capturePayment = async (req, res) => {
  try {
    const accessToken = await getAccesToken(); // Obtain access token
    console.log("Backend: Access Token obtained for payment capture.");

    // FIX: Use orderID for consistency with frontend and standard PayPal terminology
    const { orderID } = req.params;
    console.log("Backend: Request Params:", req.params); // Will now show { orderID: '...' }
    console.log(
      "Backend: Attempting to capture payment for Order ID:",
      orderID
    );

    const response = await got.post(
      // Correctly POST method for capture
      `${process.env.PAYPAL_BASEURL}/v2/checkout/orders/${orderID}/capture`, // Use orderID here
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        responseType: "json", // `got` will parse PayPal's response body as JSON
      }
    );

    const paymentData = response.body; // This is the parsed JSON object from PayPal's capture API
    console.log("Backend: PayPal Capture API Full Response:", paymentData);

    // Check the status from PayPal's capture response
    if (paymentData.status !== "COMPLETED") {
      console.error(
        "Backend: PayPal capture status was not COMPLETED:",
        paymentData.status
      );
      // If payment is not completed, return a 400 Bad Request or similar client error
      return res.status(400).json({
        error: "Payment not completed or failed by PayPal",
        details: paymentData, // Send full details for frontend debugging
      });
    }

    // If status IS "COMPLETED", proceed with success logic
    const email = paymentData.payer.email_address;
    const daysToExtend = 30; // Extend subscription by 30 days
    const currentDate = new Date();
    // Note: `setDate` modifies the `currentDate` object. Make a copy if you need original `currentDate`.
    const tierEndAt = new Date(
      currentDate.setDate(currentDate.getDate() + daysToExtend)
    );

    // FIX: Explicitly send a success response back to the frontend
    return res.status(200).json({
      message: "Payment captured successfully",
      user: {
        email,
        tier: "pro",
        tierEndAt,
      },
      capture: paymentData, // Optionally include full capture data for frontend
    });
  } catch (error) {
    console.error("Backend: Error capturing payment.");
    if (error.response) {
      console.error("Status:", error.response.statusCode);
      console.error("Body:", error.response.body);
      // Send PayPal's error back to the frontend
      return res.status(error.response.statusCode || 500).json({
        error: error.response.body.message || "PayPal API Error during capture",
        details: error.response.body.details || error.response.body,
      });
    } else {
      console.error("Error message:", error.message);
      // Send a generic internal server error if no specific PayPal response
      return res.status(500).json({
        error: error.message || "Internal Error. Failed to capture payment",
      });
    }
  }
};

router.post("/createorder", createOrder); // Route for creating order
router.post("/capturepayment/:orderID", capturePayment); // FIX: Route uses :orderID now

export default router;
