import pytest
from playwright.sync_api import Page, expect

BASE_URL = "https://www.saucedemo.com/"

def login(page: Page):
    page.goto(BASE_URL)
    page.wait_for_load_state("networkidle")
    expect(page.locator(".login_wrapper-inner")).to_be_visible()
    page.fill("[data-test='username']", "standard_user")
    page.fill("[data-test='password']", "secret_sauce")
    page.click("[data-test='login-button']")
    expect(page.locator(".inventory_list")).to_be_visible()

@pytest.mark.e2e
def test_listing_and_open_detail(page: Page):
    login(page)
    expect(page.locator(".inventory_item").first).to_be_visible()
    if page.locator("[data-test='item-4-title-link']").count() > 0:
        page.click("[data-test='item-4-title-link']")
    else:
        page.click("text=Sauce Labs Backpack")
    expect(page.locator(".inventory_details_name")).to_have_text("Sauce Labs Backpack")
    expect(page.locator(".inventory_details_desc")).to_be_visible()

@pytest.mark.e2e
def test_checkout_until_summary(page: Page):
    login(page)

    # Ürün detayına git
    if page.locator("[data-test='item-4-title-link']").count() > 0:
        page.click("[data-test='item-4-title-link']")
    else:
        page.click("text=Sauce Labs Backpack")

    # Ürün ismini doğrula
    expect(page.locator(".inventory_details_name")).to_have_text("Sauce Labs Backpack")

    # "Add to cart" butonu bazı ortamlarda farklı selector'larla gelir
    add_btn = page.locator("[data-test='add-to-cart-sauce-labs-backpack']")
    if add_btn.count() == 0:
        add_btn = page.locator("[data-test='add-to-cart']")
    if add_btn.count() == 0:
        add_btn = page.get_by_role("button", name="Add to cart")

    # Buton görünürse tıkla
    expect(add_btn).to_be_visible()
    add_btn.click()

    # Sepete git ve checkout başlat
    page.click(".shopping_cart_link")
    expect(page.locator(".cart_item")).to_be_visible()
    page.click("[data-test='checkout']")

    # Checkout formunu doldur
    page.fill("[data-test='firstName']", "John")
    page.fill("[data-test='lastName']", "Doe")
    page.fill("[data-test='postalCode']", "12345")
    page.click("[data-test='continue']")

    # Sipariş özetini kontrol et
    expect(page.locator(".summary_total_label")).to_contain_text("Total")
    expect(page.locator(".cart_item .inventory_item_name")).to_contain_text("Sauce Labs Backpack")
