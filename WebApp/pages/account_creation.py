from __init__ import *
from pages.nav import *
import datetime

from app import app


main_acc = html.Div(
    [
        navbar,  # add the navbar from nav.py

        html.Br(),  # Vertical space
        html.Br(),

        dbc.Card([
            
                
        ],
            body=True,
            className='container bg-secondary rounded',
        ),
        html.Div(id='page-mainabout-content'),
    ],
)