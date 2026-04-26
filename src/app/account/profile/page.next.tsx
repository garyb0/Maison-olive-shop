import { getCurrentUser } from "@/lib/auth";
import { getCurrentLanguage } from "@/lib/language";
import { getDeliveryAddressesForUser } from "@/lib/delivery-addresses";
import { AccountProfileClient } from "./profile-client";

export default async function AccountProfilePage() {
  const [user, language] = await Promise.all([getCurrentUser(), getCurrentLanguage()]);
  const deliveryAddresses = user ? await getDeliveryAddressesForUser(user.id) : [];

  return <AccountProfileClient user={user} language={language} initialDeliveryAddresses={deliveryAddresses} />;
}
