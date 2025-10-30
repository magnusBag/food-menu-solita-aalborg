export type MenuItem = {
  id?: number;
  description: string;
  name: string;
  productId: string;
  moduleId: string;
  dateSeconds: number;
  type: "meat" | "veggie";
  date: string;
  imageurl?: string;
  averageRating?: number | null;
  ratingCount?: number;
};
