from __init__ import *
from pages.nav import *
import dash
from dash import dcc
from dash import html
from dash import dash_table
import pandas as pd
from dash.dependencies import Input, Output

df = pd.read_csv(database_path+'scores.csv')
df = df.sort_values(by='Score', ascending=False)

from app import app

main_score = html.Div(
    [
        # Assuming 'navbar' is defined in your 'nav.py'
        navbar,

        html.Br(),  # Vertical space
        html.Br(),

        # Leaderboard table
        dash_table.DataTable(
            id='leaderboard',
            columns=[{"name": i, "id": i} for i in df.columns],
            data=df.to_dict('records'),
            style_table={'height': '300px', 'overflowY': 'auto'},
            style_cell={'textAlign': 'left'},
            style_header={
                'backgroundColor': 'white',
                'fontWeight': 'bold'
            },
        ),

        html.Div(id='page-mainabout-content'),
    ],
    className='container bg-secondary rounded',
)