// import nodemailer, { type Transporter } from 'nodemailer';
// import {ENV} from '../config/env.js';

// const transporter: Transporter = nodemailer.createTransport({
//     service: 'gmail',
//     auth: {
//         user: ENV.USER_EMAIL as string,
//         pass: ENV.EMAIL_APP_PASSWORD as string  
//     }
// });

// export async function sendEmail(to: string, subject: string, text: string): Promise<void> {
//     const mailOptions = {
//         from: ENV.USER_EMAIL as string,
//         to,
//         subject,
//         text
//     };

//     await transporter.sendMail(mailOptions);
// }
