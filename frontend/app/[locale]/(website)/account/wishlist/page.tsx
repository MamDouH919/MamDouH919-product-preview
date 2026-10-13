"use client";

import { useTranslation } from "react-i18next";
import { Button, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import FavoriteBorder from "@mui/icons-material/FavoriteBorder";
import { useWishlistQuery } from "@/backend-api/customers/hooks";
import ProductCard from "@/components/ProductCard";
import CustomLink from "@/components/CustomLink";

const WishlistPage = () => {
  const { t, i18n } = useTranslation();
  const { data: products, isLoading } = useWishlistQuery();

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3.5 }, borderRadius: 3 }}>
      <Typography variant="h6" fontWeight={700} mb={2.5}>
        {t("wishlist")}
      </Typography>

      {isLoading ? (
        <Stack alignItems="center" py={6}>
          <CircularProgress />
        </Stack>
      ) : !products?.length ? (
        <Stack alignItems="center" spacing={2} py={6} textAlign="center">
          <FavoriteBorder sx={{ fontSize: 56, color: "text.disabled" }} />
          <Typography color="text.secondary">{t("wishlistEmpty")}</Typography>
          <CustomLink href="/products">
            <Button variant="contained">{t("browseProducts")}</Button>
          </CustomLink>
        </Stack>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
          {products.map((product) => (
            <ProductCard key={product._id} product={product} lang={i18n.language} />
          ))}
        </div>
      )}
    </Paper>
  );
};

export default WishlistPage;
