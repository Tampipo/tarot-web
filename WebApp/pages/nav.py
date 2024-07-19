from __init__ import *
from app import app
PLOTLY_LOGO = "https://images.plot.ly/logo/new-branding/plotly-logomark.png"


collapse =dbc.Row(
    [   dbc.Col(
            dbc.Button("New game", color="primary", href = "/page_game", className="ml-2", id = "home"),
            width="auto",
        ),
        dbc.Col(
            dbc.Button("Scoreboard", color="primary", href = "/page_scoreboard",className="ml-2", id = "score"),
            width="auto",
        ),
        dbc.Col(
            dbc.Button("Statistics", color="primary", href = "/page_statistics", className="ml-2", id = "stats"),
            width="auto",
        ),
        dbc.Col(
            dbc.Button("New player", color="primary", href = "/page_newplayer", className="ml-2", id = "player"),
            width="auto",
        ),
        dbc.Col(
            dbc.Button("Home", color="primary", href = "/page_home", className="ml-2", id = "home"),
            width="auto",
        ),

    ],
    className="ml-auto flex-nowrap mt-3 mt-md-0",
    align="center",
     style={'flex-wrap': 'wrap'}
)

dropdown = dbc.DropdownMenu(
    children=[
        dbc.DropdownMenuItem("New Game", href="/page_game"),
        dbc.DropdownMenuItem("Scoreboard", href="/page_scoreboard"),
        dbc.DropdownMenuItem("Statistics", href="/page_statistics"),
        dbc.DropdownMenuItem("New Player", href="/page_newplayer"),
        dbc.DropdownMenuItem("Home", href="/page_home"),
    ],
    nav=True,
    in_navbar=True,
    label="Menu",  # This is the text that will be displayed for the dropdown
)
navbar = dbc.Navbar(
    [
        html.A(
            # Use row and col to control vertical alignment of logo / brand
            dbc.Row(
                [
                    dbc.Col(html.Img(src='data:image/png;base64,{}'.format(encoded_image_cards.decode()),
                                height = 60,
                            )),
                    dbc.Col(dbc.NavbarBrand(html.H2("Tarot WebApp"), className="ml-2")),
                ],
                align="center",
            ),
            href="/page_home", 
        ),
        dbc.NavbarToggler(id="navbar-toggler"),
        dbc.Collapse(collapse, id="navbar-collapse", navbar=True),

    ],
    color="primary",
    dark=True,
)

@app.callback(
    Output("navbar-collapse", "is_open"),
    [Input("navbar-toggler", "n_clicks")],
    [State("navbar-collapse", "is_open")],
)
def toggle_collapse(n, is_open):
    if n:
        return not is_open
    return is_open