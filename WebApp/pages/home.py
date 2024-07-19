from __init__ import *
from pages.nav import *
import datetime

from app import app


main_home = html.Div(
    [
        navbar,  # add the navbar from nav.py

        html.Br(),  # Vertical space
        html.Br(),

        dbc.Card(
            [
                dbc.CardHeader(html.H2("Welcome to Our Tarot WebApp", className="text-center")),
                dbc.CardBody([
                    html.P(
                        "This app is designed to keep count of scores in Tarot games.",
                        className="card-text",
                    ),
                    html.P(
                        "How to proceed",
                        className="card-text",
                    ),
                    html.Ul([
                        html.Li("If you're a new player, create an account in the 'New Player' page."),
                        html.Li("To start a new game, click on 'New Game' in the navigation bar."),
                        html.Li("Statistics : to keep track of some relevant statistics amongst players, click on 'Statistics' in the navigation bar."),
                        html.Li("To display the overall scoreboard, click on 'Scoreboard' in the navigation bar."),
                        html.Li("Otherwise, juste go ahead and start a new game!"),
                    ]),
                    html.P(
                        "Please contact me at tanguy(dot)marsault(at)gmail(dot)com for any questions or suggestions.",
                        className="card-text",
                    ),
                ]),
            ],
            body=True,
            className='container bg-secondary rounded',
        ),
        html.Div(id='page-mainabout-content'),
    ],
)