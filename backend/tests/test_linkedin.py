from app.linkedin import is_masked


def test_blurred_fields_are_masked():
    # What LinkedIn shows logged-out visitors in place of job titles and company names.
    assert is_masked("*******")
    assert is_masked("**** ***** ********")


def test_real_text_is_not_masked():
    assert not is_masked("Kasanki Labs")
    assert not is_masked("")
    assert not is_masked("C*-algebra researcher")
