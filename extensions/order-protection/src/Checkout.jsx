import React, { useEffect, useState } from "react";

import {
  Banner,
  Checkbox,
  Text,
  Spinner,
  Link,
  useApi,
  useTranslate,
  reactExtension,
  BlockStack,
  SkeletonText,
  useCartLines,
  useApplyCartLinesChange,
  useSettings,
  TextBlock,
  Modal,
  useBuyerJourneyIntercept,
  InlineStack,
  Heading,
  BlockSpacer,
  View
} from '@shopify/ui-extensions-react/checkout';


export default reactExtension(
  'purchase.checkout.shipping-option-list.render-after',
  () => <Extension />,
);

function Extension() {
  const { ui, i18n, query } = useApi();
  const applyCartLinesChange = useApplyCartLinesChange();
  const [product, setProduct] = useState({});
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [showError, setShowError] = useState(false);
  const [checked, setChecked] = useState(false);
  const [isProductVariantInCart, setisProductVariantInCart] = useState(false);
  const settings = useSettings();
  const {graphqlId} = settings;
  const lines = useCartLines();

  useEffect(() => {
    fetchProduct();
  }, []);

  // If an offer is added and an error occurs, then show some error feedback using a banner
  useEffect(() => {
    if (showError) {
      const timer = setTimeout(() => setShowError(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [showError]);


  
  useEffect(() => {
    const cartLineId = getProductsOnOffer(lines, product);
    const isProductVariantInCart = cartLineId !== '';
    setisProductVariantInCart(isProductVariantInCart);
    setChecked(isProductVariantInCart)
  }, [lines, product]);



  async function handleProductAdd() {

    setAdding(true);
    const variants = product?.variants;
    const cartLineId = getProductsOnOffer(lines, product);

    // Apply the cart lines change
    const result = isProductVariantInCart ?
    await applyCartLinesChange({
      type: "removeCartLine",
      id: cartLineId,
      quantity: 1,
    })
    :
    await applyCartLinesChange({
      type: "addCartLine",
      merchandiseId: variants.nodes[0].id,
      quantity: 1,
    });

    setAdding(false);

    setChecked(!isProductVariantInCart);

    if (result.type === "error") {
      setShowError(true);
      console.error(result.message);
    }
  }

  async function fetchProduct() {
    setLoading(true);
    try {
      const { data } = await query(
        `query ($id: ID!) {
          product(id: $id) {
              id
              title
              images(first:1){
                nodes {
                  url
                }
              }
              variants(first: 1) {
                nodes {
                  id
                  price {
                    amount
                  }
                }
              }
          }
        }`,
        {
          variables: { id: graphqlId },
        },
      );
      setProduct(data ? data?.product : {});
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  // Use the `buyerJourney` intercept to conditionally block checkout progress
  // The ability to block checkout progress isn't guaranteed.
  // Refer to the "Checking for the ability to block checkout progress" section for more information.
  useBuyerJourneyIntercept(({ canBlockProgress }) => {

    if(canBlockProgress && (loading || adding)){
      return {
        reason: "Waiting for product to add or load",
        behavior: "block",
      };
    }

    return {
      behavior: "allow",
    };
  });

  if (loading) {
    return <LoadingSkeleton />;
  }

  // If product variants can't be loaded, then show nothing
  if (!loading && !('id' in product)) {
    return null;
  }

  
  return (
    <ProductOffer
      product={product}
      i18n={i18n}
      adding={adding}
      handleProductAdd={handleProductAdd}
      showError={showError}
      checked={checked}
      settings={settings}
      ui={ui}
    />
  );
}


function LoadingSkeleton() {
  return (
    <BlockStack 
        border="base"
        borderWidth="base"
        cornerRadius="base"
        padding="base"
        >
        <Checkbox disabled={true}>
          <SkeletonText size="medium" emphasis="bold"></SkeletonText>
          <SkeletonText size="medium" emphasis="bold"></SkeletonText>
        </Checkbox>
        <SkeletonText size="base"></SkeletonText>
        <SkeletonText size="base"></SkeletonText>
      </BlockStack>
  );
}

/**
 * @param {any[]} lines
 * @param {{ variants?: any; }} product
 */
function getProductsOnOffer(lines, product) {

  // Get the IDs of all product variants in the cart
  const cartLineProductVariantIds = lines.map((item) => item.merchandise.id);
  
  // Finding if our product is already in cart
  const firstVariantId = product?.variants?.nodes[0].id ?? '';

  if (cartLineProductVariantIds.includes(firstVariantId)) {
    return lines.find((item) => item?.merchandise.id == firstVariantId)?.id ?? '';
  }

  return '';
}

function ProductOffer({ product, i18n, adding, handleProductAdd, showError, checked, settings, ui}) {

  const { variants } = product;
  const { heading, sub_heading, description_line_1, description_line_2 } = settings;
  const translate = useTranslate();
  const renderPrice = i18n.formatCurrency(variants?.nodes[0].price.amount);
  
  return (
    <BlockStack
    spacing="base"
    >
      <BlockSpacer spacing="base" />
      <Heading level={2}>{heading}</Heading>
      <View>
        <BlockStack 
          border="base"
          borderWidth="base"
          cornerRadius="base"
          padding="base"
        >
          {adding ? 
          (<InlineStack spacing="base" blockAlignment="center" inlineAlignment="start">
            <Spinner size="base" /><Text size="base" emphasis="bold">{sub_heading} {renderPrice}</Text>
          </InlineStack>) : 
          (<Checkbox disabled={adding} checked={checked} onChange={handleProductAdd}>
            <Text size="base" emphasis="bold">{sub_heading} {renderPrice}</Text>
          </Checkbox>)  
        }
        
        <TextBlock size="small">{description_line_1} <Link overlay={orderProtectModal(translate)}> More info</Link></TextBlock> 
        {checked ? (
          <TextBlock size="small" appearance="subdued">
            {description_line_2} 
          </TextBlock>
          ) : null }

          {showError && (
            <Banner status="critical">{translate('error')}</Banner>
          )}
        </BlockStack>
      </View>
      <BlockSpacer spacing="base" />
    </BlockStack>
  );
}


function orderProtectModal(translate){

  return (<Modal
    id="shipping-policy-modal"
    padding
    title={translate('modal_heading')}
  >

    <BlockStack inlineAlignment="start">

      <Text appearance="subdued" size="medium">For peace of mind, we recommend that you add Order Protection during checkout.</Text>

      <TextBlock>
        <Text size="medium" emphasis="bold">If you purchase Order Protection and your items are lost or damaged in transit, we’ll send out a replacement immediately.</Text>
      </TextBlock>
      <Text appearance="subdued" size="medium">If your items are no longer in stock, we'll refund the cost of the items.</Text>
      <Text appearance="subdued" size="medium">If your order is delivered to the wrong address, or goes missing after being delivered without the required signature, we will need to open an investigation with Australia Post before we can ship a replacement to you.</Text>

      <TextBlock>
        <Text size="medium" emphasis="bold">Note: </Text> 
        <Text appearance="subdued" size="medium">If you authorise delivery without a signature, then we cannot accept responsibility for any claim made by you for a lost package, if the carrier has confirmed the package has been delivered. In these circumstances you are responsible for the safety of your package once it has been delivered.</Text>
      </TextBlock>


      <TextBlock>
        <Text size="medium" emphasis="bold">Making a claim: </Text>
        <Text appearance="subdued" size="medium">If you need to make a claim on your Order Protection Guarantee, please contact us with your order number and other information about your claim.</Text>
      </TextBlock>

    </BlockStack>
  </Modal>);
}
