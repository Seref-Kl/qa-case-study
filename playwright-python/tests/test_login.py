import pytest
from playwright.sync_api import Page, expect

BASE_URL = "https://www.saucedemo.com/"

@pytest.mark.e2e
@pytest.mark.smoke
def test_login_success(page: Page):
    page.goto(BASE_URL)
    page.wait_for_load_state("networkidle")
    expect(page.locator(".login_wrapper-inner")).to_be_visible()
    page.fill("[data-test='username']", "standard_user")
    page.fill("[data-test='password']", "secret_sauce")
    page.click("[data-test='login-button']")
    expect(page.locator(".inventory_list")).to_be_visible()

@pytest.mark.e2e
def test_login_failure(page: Page):
    page.goto(BASE_URL)
    expect(page.locator(".login_wrapper-inner")).to_be_visible()
    page.fill("[data-test='username']", "wrong_user")
    page.fill("[data-test='password']", "wrong_pass")
    page.click("[data-test='login-button']")
    expect(page.locator("[data-test='error']")).to_be_visible()
