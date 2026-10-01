import crypto from "crypto"; 

export const generateOtp = (): string => {
  const otp = crypto.randomInt(1000, 10000).toString();
  return otp;
};


export async function sendOtpSMS(mobile: string, otp: number): Promise<string> {
    const url = process.env.SMS_BASE_URL!;
    
    const params = new URLSearchParams({
        AUTH_KEY: process.env.SMS_AUTH_KEY!,
        senderId: process.env.SMS_SENDER_ID!,
        routeId: process.env.SMS_ROUTE_ID!,
        mobileNos: mobile,
        entityid: process.env.SMS_ENTITY_ID!,
        message: `Your OTP is ${otp}. Use this to verify your mobile number on Minta Fresh. Valid For 5 Minutes. Team MINTA CLUB PRIVATE LIMITED`,
        smsContentType: "english",
    });

    try {
        const response = await fetch(`${url}?${params.toString()}`, {
            method: "GET",
        });

        const data = await response.text();
        console.log("SMS API Response:", data);
        return data;
    } catch (error) {
        console.error("SMS API Error:", error);
        throw error;
    }
}

