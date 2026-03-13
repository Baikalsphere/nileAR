import nodemailer from "nodemailer";
import { Resend } from "resend";
import { config } from "../config.js";

let transporter: nodemailer.Transporter | null = null;
let resendClient: Resend | null = null;

type SendMailPayload = {
  to: string;
  cc?: string;
  subject: string;
  text: string;
  html: string;
};

const getResendClient = () => {
  if (!config.mailEnabled || config.mailProvider !== "resend" || !config.resendApiKey || !config.resendFrom) {
    throw new Error("Resend email service is not configured on the server");
  }

  if (!resendClient) {
    resendClient = new Resend(config.resendApiKey);
  }

  return resendClient;
};

const getTransporter = () => {
  if (!config.mailEnabled || config.mailProvider !== "smtp") {
    throw new Error("SMTP email service is not configured on the server");
  }

  if (!transporter) {
    console.info("[mailer] Initializing transporter", {
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      hasUser: Boolean(config.smtpUser),
      hasPass: Boolean(config.smtpPass),
      from: config.smtpFrom,
      mailEnabled: config.mailEnabled
    });

    transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      tls: {
        rejectUnauthorized: true
      },
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass
      }
    });
  }

  return transporter;
};

const sendMail = async (payload: SendMailPayload) => {
  if (!config.mailEnabled || !config.mailProvider) {
    throw new Error("Email service is not configured on the server");
  }

  if (config.mailProvider === "resend") {
    const resend = getResendClient();
    const { error } = await resend.emails.send({
      from: config.resendFrom!,
      to: [payload.to],
      cc: payload.cc ? [payload.cc] : undefined,
      subject: payload.subject,
      text: payload.text,
      html: payload.html
    });

    if (error) {
      throw new Error(`Resend send failed: ${error.message}`);
    }

    return;
  }

  const tx = getTransporter();
  await tx.sendMail({
    from: config.smtpFrom,
    to: payload.to,
    cc: payload.cc,
    subject: payload.subject,
    text: payload.text,
    html: payload.html
  });
};

export const sendCorporateCredentialsEmail = async (payload: {
  recipientEmail: string;
  organizationName: string;
  userId: string;
  password: string;
}) => {
  await sendMail({
    to: payload.recipientEmail,
    subject: `Corporate Portal Credentials - ${payload.organizationName}`,
    text: [
      `Hello ${payload.organizationName},`,
      "",
      "Your Corporate Portal login credentials are:",
      `User ID: ${payload.userId}`,
      `Password: ${payload.password}`,
      "",
      "Please sign in and change your password after the first login.",
      ""
    ].join("\n"),
    html: `
      <p>Hello ${payload.organizationName},</p>
      <p>Your Corporate Portal login credentials are:</p>
      <p><strong>User ID:</strong> ${payload.userId}<br/><strong>Password:</strong> ${payload.password}</p>
      <p>Please sign in and change your password after the first login.</p>
    `
  });
};

export const sendHotelCredentialsEmail = async (payload: {
  recipientEmail: string;
  hotelName: string;
  userId: string;
  password: string;
}) => {
  await sendMail({
    to: payload.recipientEmail,
    subject: `Hotel Finance Credentials - ${payload.hotelName}`,
    text: [
      `Hello ${payload.hotelName},`,
      "",
      "Your Hotel Finance account has been created.",
      "Your login credentials are:",
      `User ID: ${payload.userId}`,
      `Password: ${payload.password}`,
      "",
      "Your account has been linked to the Baikalsphere centralized authentication system.",
      "You can now access both the Hotel Finance module and other Baikalsphere modules with your credentials.",
      "",
      "Visit the Hotel Profile section to update your password.",
      ""
    ].join("\n"),
    html: `
      <p>Hello ${payload.hotelName},</p>
      <p>Your Hotel Finance account has been created.</p>
      <p>Your login credentials are:</p>
      <p><strong>User ID:</strong> ${payload.userId}<br/><strong>Password:</strong> ${payload.password}</p>
      <p>Your account has been linked to the <strong>Baikalsphere</strong> centralized authentication system.<br/>
      You can now access both the Hotel Finance module and other Baikalsphere modules with your credentials.</p>
      <p>Visit the Hotel Profile section to update your password.</p>
    `
  });
};

export const sendContractSignatureLinkEmail = async (payload: {
  recipientEmail: string;
  organizationName: string;
  hotelName: string;
  signLink: string;
}) => {
  await sendMail({
    to: payload.recipientEmail,
    subject: `Contract Signature Request - ${payload.organizationName}`,
    text: [
      `Hello ${payload.organizationName},`,
      "",
      `Your contract from ${payload.hotelName} is ready for digital signature.`,
      "Please open the link below and sign it:",
      payload.signLink,
      "",
      "If the link expires, please request a new one.",
      ""
    ].join("\n"),
    html: `
      <p>Hello ${payload.organizationName},</p>
      <p>Your contract from <strong>${payload.hotelName}</strong> is ready for digital signature.</p>
      <p>Please open the link below and sign it:</p>
      <p><a href="${payload.signLink}">${payload.signLink}</a></p>
      <p>If the link expires, please request a new one.</p>
    `
  });
};

export const sendCorporateInvoiceCoverLetterEmail = async (payload: {
  recipientEmail: string;
  ccEmail?: string | null;
  organizationName: string;
  invoiceNumber: string;
  bookingNumber: string;
  guestName: string;
  amount: number;
  dueDate: string;
  propertyName: string;
  bills: Array<{ category: string; fileName: string }>;
  invoicesPortalLink: string;
}) => {
  const billsText = payload.bills.length
    ? payload.bills.map((bill, index) => `${index + 1}. ${bill.category} — ${bill.fileName}`).join("\n")
    : "No supporting bills attached";

  const billsHtml = payload.bills.length
    ? `<ul>${payload.bills
        .map((bill) => `<li><strong>${bill.category}</strong> — ${bill.fileName}</li>`)
        .join("")}</ul>`
    : `<p>No supporting bills attached.</p>`;

  await sendMail({
    to: payload.recipientEmail,
    cc: payload.ccEmail ?? undefined,
    subject: `Invoice ${payload.invoiceNumber} - ${payload.organizationName}`,
    text: [
      `Hello ${payload.organizationName},`,
      "",
      `Please find your invoice details below:`,
      `Invoice Number: ${payload.invoiceNumber}`,
      `Booking Number: ${payload.bookingNumber}`,
      `Guest: ${payload.guestName}`,
      `Property: ${payload.propertyName}`,
      `Amount: INR ${payload.amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`,
      `Due Date: ${payload.dueDate}`,
      "",
      "Supporting bills:",
      billsText,
      "",
      "For secure access, login to your corporate portal and open invoices:",
      payload.invoicesPortalLink,
      ""
    ].join("\n"),
    html: `
      <p>Hello ${payload.organizationName},</p>
      <p>Please find your invoice details below:</p>
      <p>
        <strong>Invoice Number:</strong> ${payload.invoiceNumber}<br/>
        <strong>Booking Number:</strong> ${payload.bookingNumber}<br/>
        <strong>Guest:</strong> ${payload.guestName}<br/>
        <strong>Property:</strong> ${payload.propertyName}<br/>
        <strong>Amount:</strong> INR ${payload.amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}<br/>
        <strong>Due Date:</strong> ${payload.dueDate}
      </p>
      <p><strong>Supporting bills:</strong></p>
      ${billsHtml}
      <p>For secure access, login to your corporate portal and open invoices:</p>
      <p><a href="${payload.invoicesPortalLink}">${payload.invoicesPortalLink}</a></p>
    `
  });
};

export const sendBookingRequestHotelNotificationEmail = async (payload: {
  recipientEmail: string;
  hotelName: string;
  organizationName: string;
  bookingNumber: string;
  employeeName: string;
  roomType: string;
  checkInDate: string;
  checkOutDate: string;
  totalPrice: number;
}) => {
  await sendMail({
    to: payload.recipientEmail,
    subject: `New Booking Request - ${payload.organizationName}`,
    text: [
      `Hello ${payload.hotelName},`,
      "",
      `A new booking request has been submitted by ${payload.organizationName}.`,
      `Booking Number: ${payload.bookingNumber}`,
      `Employee: ${payload.employeeName}`,
      `Room Type: ${payload.roomType}`,
      `Check-in: ${payload.checkInDate}`,
      `Check-out: ${payload.checkOutDate}`,
      `Estimated Amount: INR ${payload.totalPrice.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`,
      "",
      "Please review this request in the Bookings > Booking Requests tab.",
      ""
    ].join("\n"),
    html: `
      <p>Hello ${payload.hotelName},</p>
      <p>A new booking request has been submitted by <strong>${payload.organizationName}</strong>.</p>
      <p>
        <strong>Booking Number:</strong> ${payload.bookingNumber}<br/>
        <strong>Employee:</strong> ${payload.employeeName}<br/>
        <strong>Room Type:</strong> ${payload.roomType}<br/>
        <strong>Check-in:</strong> ${payload.checkInDate}<br/>
        <strong>Check-out:</strong> ${payload.checkOutDate}<br/>
        <strong>Estimated Amount:</strong> INR ${payload.totalPrice.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
      </p>
      <p>Please review this request in the Bookings &gt; Booking Requests tab.</p>
    `
  });
};

export const sendBookingRequestAcceptedOrganizationEmail = async (payload: {
  recipientEmail: string;
  organizationName: string;
  hotelName: string;
  bookingNumber: string;
  employeeName: string;
  roomType: string;
  checkInDate: string;
  checkOutDate: string;
}) => {
  await sendMail({
    to: payload.recipientEmail,
    subject: `Booking Request Accepted - ${payload.bookingNumber}`,
    text: [
      `Hello ${payload.organizationName},`,
      "",
      `${payload.hotelName} has accepted your booking request.`,
      `Booking Number: ${payload.bookingNumber}`,
      `Employee: ${payload.employeeName}`,
      `Room Type: ${payload.roomType}`,
      `Check-in: ${payload.checkInDate}`,
      `Check-out: ${payload.checkOutDate}`,
      "",
      "You can now continue with the regular booking and invoice workflow.",
      ""
    ].join("\n"),
    html: `
      <p>Hello ${payload.organizationName},</p>
      <p><strong>${payload.hotelName}</strong> has accepted your booking request.</p>
      <p>
        <strong>Booking Number:</strong> ${payload.bookingNumber}<br/>
        <strong>Employee:</strong> ${payload.employeeName}<br/>
        <strong>Room Type:</strong> ${payload.roomType}<br/>
        <strong>Check-in:</strong> ${payload.checkInDate}<br/>
        <strong>Check-out:</strong> ${payload.checkOutDate}
      </p>
      <p>You can now continue with the regular booking and invoice workflow.</p>
    `
  });
};

export const sendPortalUserCredentialsEmail = async (payload: {
  recipientEmail: string;
  userName: string;
  portalName: string;
  loginEmail: string;
  password: string;
  portalType: "hotel_finance" | "corporate";
}) => {
  const portalLabel = payload.portalType === "hotel_finance" ? "Hotel Finance Portal" : "Corporate Portal";

  await sendMail({
    to: payload.recipientEmail,
    subject: `Your ${portalLabel} Account - ${payload.portalName}`,
    text: [
      `Hello ${payload.userName},`,
      "",
      `An account has been created for you on the ${payload.portalName}.`,
      "",
      "Your login credentials are:",
      `Email: ${payload.loginEmail}`,
      `Password: ${payload.password}`,
      "",
      "Please sign in and change your password from the settings page.",
      ""
    ].join("\n"),
    html: `
      <p>Hello ${payload.userName},</p>
      <p>An account has been created for you on the <strong>${payload.portalName}</strong>.</p>
      <p>Your login credentials are:</p>
      <p>
        <strong>Email:</strong> ${payload.loginEmail}<br/>
        <strong>Password:</strong> ${payload.password}
      </p>
      <p>Please sign in and change your password from the settings page.</p>
    `
  });
};