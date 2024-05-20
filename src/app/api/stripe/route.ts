import Stripe from "stripe";
import { authOptions } from "@/libs/auth";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { getRoom } from "@/libs/apis";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-04-10',
});

type RequestData = {
  checkinDate: string;
  checkoutDate: string;
  adults: number;
  children: number;
  numberOfDays: number;
  hotelRoomSlug: string;
};

export async function POST(req: Request) {
  try {
    const {
      checkinDate,
      checkoutDate,
      adults,
      children,
      hotelRoomSlug,
      numberOfDays,
    }: RequestData = await req.json();

    if (!checkinDate || !checkoutDate || !adults || !hotelRoomSlug || !numberOfDays) {
      return new NextResponse('All fields are required', { status: 400 });
    }

    const origin = req.headers.get('origin');

    const session = await getServerSession(authOptions);

    if (!session) {
      return new NextResponse('Authentication required', { status: 401 });
    }

    const userId = session.user.id;
    const formattedCheckoutDate = checkoutDate.split('T')[0];
    const formattedCheckinDate = checkinDate.split('T')[0];

    const room = await getRoom(hotelRoomSlug);
    const discountPrice = room.price - (room.price / 100) * room.discount;
    const totalPrice = discountPrice * numberOfDays;

    // Create Stripe Payment
    const stripeSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            product_data: {
              name: room.name,
              images: room.images.map(image => image.url),
            },
            unit_amount: Math.round(totalPrice * 100), // Stripe expects amount in cents
          },
        },
      ],
      payment_method_types: ['card'],
      success_url: `${origin}/users/${userId}`,
      cancel_url: `${origin}/cancel`, // Add a cancel URL
    });

    return NextResponse.json({ id: stripeSession.id });
  } catch (error: any) {
    console.error("Payment failed", error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
