from datetime import datetime

from pydantic import BaseModel


class EmailTemplate(BaseModel):
    """Email notification templates"""

    @staticmethod
    def booking_confirmation(booking_id: int, quoted_amount_php: float, scheduled_date: str) -> tuple[str, str]:
        """Generate booking confirmation email"""
        subject = f"Booking Confirmation - #{booking_id}"
        html = f"""
        <html>
            <body style="font-family: Arial, sans-serif; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #0f766e;">Booking Confirmed! 🎉</h2>
                    
                    <p>Your booking has been successfully created.</p>
                    
                    <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p><strong>Booking ID:</strong> #{booking_id}</p>
                        <p><strong>Scheduled Date:</strong> {scheduled_date}</p>
                        <p><strong>Quoted amount (PHP):</strong> ₱{quoted_amount_php:,.2f}</p>
                    </div>
                    
                    <p>A dispatcher will review your booking and assign a truck and driver shortly.</p>
                    
                    <p>You can track your booking status in your account dashboard.</p>
                    
                    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666;">
                        <p>© 2026 FleetOpt. All rights reserved.</p>
                        <p>Questions? Contact support@fleetopt.com</p>
                    </div>
                </div>
            </body>
        </html>
        """
        return subject, html

    @staticmethod
    def trip_assigned(trip_id: int, driver_name: str, truck_code: str, pickup: str, dropoff: str) -> tuple[str, str]:
        """Generate trip assignment email"""
        subject = f"Trip Assigned - #{trip_id}"
        html = f"""
        <html>
            <body style="font-family: Arial, sans-serif; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #0f766e;">Your Trip Has Been Assigned ✓</h2>
                    
                    <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p><strong>Trip ID:</strong> #{trip_id}</p>
                        <p><strong>Driver:</strong> {driver_name}</p>
                        <p><strong>Truck:</strong> {truck_code}</p>
                        <p><strong>Pickup:</strong> {pickup}</p>
                        <p><strong>Dropoff:</strong> {dropoff}</p>
                    </div>
                    
                    <p>Your shipment is now assigned to our team. The driver will contact you shortly with pickup details.</p>
                    
                    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666;">
                        <p>© 2026 FleetOpt. All rights reserved.</p>
                    </div>
                </div>
            </body>
        </html>
        """
        return subject, html

    @staticmethod
    def delivery_completed(trip_id: int, delivered_date: str, total_cost: float) -> tuple[str, str]:
        """Generate delivery completion email"""
        subject = f"Delivery Completed - #{trip_id}"
        html = f"""
        <html>
            <body style="font-family: Arial, sans-serif; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #0f766e;">Delivery Completed! 🚚</h2>
                    
                    <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p><strong>Trip ID:</strong> #{trip_id}</p>
                        <p><strong>Delivered:</strong> {delivered_date}</p>
                        <p><strong>Total Cost:</strong> ${total_cost:.2f}</p>
                    </div>
                    
                    <p>Your shipment has been successfully delivered. Thank you for using FleetOpt!</p>
                    
                    <p style="margin-top: 20px;">
                        <a href="https://fleetopt.com/feedback" style="background: #0f766e; color: white; padding: 10px 20px; border-radius: 5px; text-decoration: none;">
                            Rate Your Experience
                        </a>
                    </p>
                    
                    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666;">
                        <p>© 2026 FleetOpt. All rights reserved.</p>
                    </div>
                </div>
            </body>
        </html>
        """
        return subject, html

    @staticmethod
    def driver_payment_summary(driver_name: str, period: str, amount: float, trips: int) -> tuple[str, str]:
        """Generate payment summary email"""
        subject = f"Payment Summary - {period}"
        html = f"""
        <html>
            <body style="font-family: Arial, sans-serif; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #0f766e;">Payment Summary</h2>
                    
                    <p>Hi {driver_name},</p>
                    
                    <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <p><strong>Period:</strong> {period}</p>
                        <p><strong>Trips Completed:</strong> {trips}</p>
                        <p><strong>Total Earnings:</strong> ${amount:.2f}</p>
                    </div>
                    
                    <p>Your payment will be processed within 2-3 business days.</p>
                    
                    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666;">
                        <p>© 2026 FleetOpt. All rights reserved.</p>
                    </div>
                </div>
            </body>
        </html>
        """
        return subject, html

    @staticmethod
    def password_reset(reset_link: str, expires_minutes: int) -> tuple[str, str]:
        """Generate password reset email."""
        subject = "Reset your FleetOpt password"
        html = f"""
        <html>
            <body style="font-family: Arial, sans-serif; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #0f766e;">Password Reset Request</h2>

                    <p>We received a request to reset your FleetOpt password.</p>
                    <p>This link expires in <strong>{expires_minutes} minutes</strong>.</p>

                    <p style="margin: 22px 0;">
                        <a href="{reset_link}" style="background: #2563EB; color: #fff; padding: 10px 16px; border-radius: 6px; text-decoration: none;">
                            Reset Password
                        </a>
                    </p>

                    <p>If the button does not work, copy and paste this URL:</p>
                    <p style="word-break: break-all;">{reset_link}</p>

                    <p>If you did not request this, you can ignore this message.</p>
                </div>
            </body>
        </html>
        """
        return subject, html
