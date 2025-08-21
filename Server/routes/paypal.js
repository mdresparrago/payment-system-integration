    import express from 'express';
    import got from 'got';
    import dotenv from 'dotenv';    

    const router = express.Router();
    // Add this line at the beginning of your getAccesToken function
console.log('Client ID:', process.env.PAYPAL_CLIENT_ID);
console.log('Client Secret:', process.env.PAYPAL_CLIENT_SECRET);

// ... rest of your code

    const getAccesToken = async () => {
    try {
        const response = await got.post(`${process.env.PAYPAL_BASEURL}/v1/oauth2/token`, {
            username: process.env.PAYPAL_CLIENT_ID,
            password: process.env.PAYPAL_CLIENT_SECRET,
            form: {
                grant_type: 'client_credentials'
            },
        });
        
        console.log(response.body);
        const data = JSON.parse(response.body);
        const newAccessToken = data.access_token;
        return newAccessToken;
    } catch (error) {
        throw new Error('Failed to get access token', { cause: error });
    }
};

    const createOrder = async (req, res) => {
        try {
            const accessToken = await getAccesToken();
            return res.status(200).json({message:"Order created successfully"})
        } catch(error){
            res.status(500).json({error:error.message || 'Internal Error. Failed to create order'})
        }
    }


    router.post('/create-order', createOrder);

    export default router