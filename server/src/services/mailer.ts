import nodemailer from "nodemailer";
import { config } from "../config.js";

let transporter: nodemailer.Transporter | null = null;

const getTransporter = () => {
  if (!config.mailEnabled) {
    throw new Error("Email service is not configured on the server");
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass
      }
    });
  }

  return transporter;
};

export const sendCorporateCredentialsEmail = async (payload: {
  recipientEmail: string;
  organizationName: string;
  userId: string;
  password: string;
}) => {
  const tx = getTransporter();

  await tx.sendMail({
    from: config.smtpFrom,
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

export const sendContractSignatureLinkEmail = async (payload: {
  recipientEmail: string;
  organizationName: string;
  hotelName: string;
  signLink: string;
}) => {
  const tx = getTransporter();

  await tx.sendMail({
    from: config.smtpFrom,
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
  const tx = getTransporter();

  const billsText = payload.bills.length
    ? payload.bills.map((bill, index) => `${index + 1}. ${bill.category} — ${bill.fileName}`).join("\n")
    : "No supporting bills attached";

  const billsHtml = payload.bills.length
    ? `<ul>${payload.bills
        .map((bill) => `<li><strong>${bill.category}</strong> — ${bill.fileName}</li>`)
        .join("")}</ul>`
    : `<p>No supporting bills attached.</p>`;

  await tx.sendMail({
    from: config.smtpFrom,
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