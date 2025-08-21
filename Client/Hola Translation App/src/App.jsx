import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import PaypalPayment from "./components/PaypalPayment";
import CompletePayment from "./pages/CompletePayment";
import CancelPayment from "./pages/CancelPayment";

const App = () => {
  return (
    <Router>
      <div className="App">
        <h1>PayPal Payment Demo</h1>
      </div>
      <Routes>
        <Route path="/" element={<PaypalPayment />} />
        <Route path="/complete-payment" element={<CompletePayment />} />
        <Route path="/cancel-payment" element={<CancelPayment />} />
      </Routes>
    </Router>
  );
};

export default App;
