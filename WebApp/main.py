#!/usr/bin/env python3

import dash
from dash import dcc
from dash import html
import dash_bootstrap_components as dbc
from dash.dependencies import Input, Output, State, ClientsideFunction

from app import app
import __init__
import pages.account_creation
import pages.scoreboard
import pages.stats
import pages.home 
import pages.game
app.layout = html.Div([
    dcc.Location(id='url', refresh=False),
    html.Div(id='page-content')
])


@app.callback(Output('page-content', 'children'),
              Input('url', 'pathname'))
def display_page(pathname):
    if pathname == '/page_scoreboard':
        return pages.scoreboard.main_score
    elif pathname == '/page_statistics':
        return pages.stats.main_stats
    elif pathname == '/page_newplayer':
        return pages.account_creation.main_acc
    elif pathname == '/page_home':
        return pages.home.main_home
    elif pathname == '/page_game':
        return pages.game.main_game
    else:
        return pages.home.main_home


if __name__ == '__main__':
    app.run_server(debug=True, host='0.0.0.0', port='8060')